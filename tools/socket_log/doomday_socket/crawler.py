"""Collect Doomsday rankings and optionally join battlefield feat by player ID.

uv run python tools/socket_log/doomday_socket/crawler.py --profile .tmp/pmain --headless --feats
"""

import argparse
import asyncio
import json
import sys
import tempfile
from datetime import datetime
from pathlib import Path

from playwright.async_api import async_playwright

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from browser.process_guard import acquire_profile_lock, release_profile_lock
from browser.session import open_game_session
from capture.frames import FrameWriter
from sea_socket.crawl.briefs import fetch_guild_briefs, fetch_player_briefs
from sea_socket.crawl.router import REQUEST_PACE, CrawlRouter

from doomday_socket.codec import decode_message

GAME_URL = "https://hauntedroomvnh5.joynetgame.com/"
MODULE = 0x67
LOCK_NAME = ".sea_crawler.lock"


def save(out: Path, name: str, value) -> None:
    (out / f"{name}.json").write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8",
    )


async def collect(page, router: CrawlRouter, out: Path, *, feats: bool) -> None:
    await page.wait_for_function("""() => {
      try { return !!window.__require('PlayerModule').PlayerModule.Ins.playerInfo?.info?.playerId; }
      catch { return false; }
    }""", timeout=180_000)

    async def ask(cmd: int, message: str, fields: list, name: str) -> dict:
        header, body = await router.inject(page, MODULE, cmd, fields)
        if (header["module"], header["cmd"]) != (MODULE, cmd + 1):
            raise RuntimeError(f"Unexpected response to {name}: {header}")
        value = await decode_message(page, "GhostWar", message + "_GhostWar_S2C", header, body)
        save(out, name, value)
        if value.get("err", 0):
            raise RuntimeError(f"{name}: server error {value['err']}")
        await asyncio.sleep(REQUEST_PACE)
        return value

    context = await ask(0x21, "GetOutGhostWarInfoR", [], "context")
    meta = await page.evaluate("""(state) => {
      const req = window.__require, p = req('PlayerModule').PlayerModule.Ins.playerInfo.info;
      const selection = state < req('GhostWarProto').GhostWarState_GhostWar_Enum.Official;
      const types = req('RankingProto').RankingType_Ranking_Enum;
      return {playerId:p.playerId, name:p.name, serverId:p.serverId,
        playerRankType:types[selection?'RankingTypeGhostWarPersonal':'RankingTypeGhostWarPersonal2'],
        guildRankType:types[selection?'RankingTypeGhostWarGuild':'RankingTypeGhostWarGuild2']};
    }""", context.get("state", 0))
    meta["eventOpen"] = context.get("isOpen", False)
    meta["eventState"] = context.get("state")
    meta["capturedAt"] = datetime.now().astimezone().isoformat()
    save(out, "meta", meta)

    players = await ask(0x41, "GetRankInfoR", [(1, meta["playerRankType"])], "player-rank")
    guilds = await ask(0x41, "GetRankInfoR", [(1, meta["guildRankType"])], "guild-rank")
    ids = sorted({r["id"] for r in players.get("ranks", [])} | {meta["playerId"]})
    members = {}
    if feats:
        for start in range(0, len(ids), 40):
            value = await ask(0x5d, "GetWarfieldMembersR", [(1, pid) for pid in ids[start:start + 40]],
                              f"members-{start // 40 + 1}")
            members.update(value.get("infos", {}))
        save(out, "members", members)

    missing_names = await fetch_player_briefs(page, router, [str(pid) for pid in ids], rounds=1)
    save(out, "player-briefs", router.briefs)
    guild_ids = sorted({r["id"] for r in guilds.get("ranks", [])})
    guild_briefs = await fetch_guild_briefs(page, router, guild_ids)
    save(out, "guild-briefs", guild_briefs)

    def player_row(row: dict) -> dict:
        pid = str(row["id"])
        brief, member = router.briefs.get(pid, {}), members.get(pid, {})
        # Missing battlefield data stays null; ranking score is never a feat fallback.
        return {**row, "name": brief.get("name"), "guildName": brief.get("guild_name"),
                "server": brief.get("server"), "feat": member.get("feat")}

    summary = {
        "meta": meta,
        "selfPlayer": players.get("myRanks"),
        "selfGuild": guilds.get("myRanks"),
        "selfFeat": context.get("selfInfo", {}).get("feat"),
        "players": [player_row(r) for r in players.get("ranks", [])],
        "guilds": [{**r, "name": guild_briefs.get(str(r["id"]), {}).get("name")}
                   for r in guilds.get("ranks", [])],
        "missingPlayerNames": missing_names,
        "missingMemberIds": [pid for pid in ids if str(pid) not in members] if feats else None,
    }
    save(out, "summary", summary)
    print(f"[doomday] {len(summary['players'])} player rows, {len(summary['guilds'])} guild rows")
    if feats:
        print(f"[doomday] battlefield data: {len(members)}/{len(ids)} requested")


async def run(args: argparse.Namespace) -> None:
    if not acquire_profile_lock(args.profile, LOCK_NAME):
        raise SystemExit("Profile is busy")
    try:
        args.out.mkdir(parents=True, exist_ok=True)
        out = Path(tempfile.mkdtemp(prefix=datetime.now().strftime("%Y%m%d-%H%M%S-"), dir=args.out))
        router = CrawlRouter(FrameWriter(out))
        async with async_playwright() as pw, open_game_session(
            pw, profile=args.profile, url=GAME_URL, headless=args.headless,
            on_page=lambda p: p.on("websocket", lambda ws: router.attach(ws, ws.url)),
        ) as page:
            await collect(page, router, out, feats=args.feats)
        print(f"[doomday] saved {out}")
    finally:
        release_profile_lock(args.profile, LOCK_NAME)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", type=Path, required=True)
    parser.add_argument("--out", type=Path, default=Path(".tmp/doomday-crawl"))
    parser.add_argument("--headless", action="store_true")
    parser.add_argument("--feats", action="store_true", help="Fetch battlefield feat for returned players and self")
    asyncio.run(run(parser.parse_args()))
