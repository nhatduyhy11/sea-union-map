"""Backfill missing player briefs for an existing sea crawl run.

The crawler's brief phase retries a throttled tail within the same session,
but server-refused ids stay refused there (cooldown, not a hard block), so
those players stay nameless in players.jsonl. This tool re-opens the session
later, asks ONLY the missing ids, and merges the answers back into the run's
players.jsonl. No map crawl.

    uv run python tools/socket_log/sea_socket/brief_backfill.py \
        --run .tmp/sea-crawl/sea-crawl-<ts> --profile .tmp/p545

Files touched: <run>/players.jsonl (merged in place); WS evidence goes to
<run>/backfill/ so the original capture stays intact.
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from playwright.async_api import WebSocket, async_playwright

from browser.process_guard import acquire_profile_lock, release_profile_lock
from browser.session import open_game_session
from capture.frames import FrameWriter
from sea_socket.crawl import LOCK_FILENAME
from sea_socket.crawl.briefs import (
    fetch_guild_briefs,
    fetch_player_briefs,
    player_ids_from_boards,
)
from sea_socket.crawl.router import CrawlRouter
from sea_socket.walkthrough import STAGES, run_stages

# Throttle evidence (2026-10-27): the crawler's 60-id batches mostly answered
# 60/60, but one came back empty — smaller chunks + pacing dodge it.
BRIEF_CHUNK = 20
REQUEST_PACE = 0.8
ROUNDS = 5  # whole passes over the still-missing tail, linear backoff between


def rank_ids(run_dir: Path) -> set[str]:
    boards = json.loads((run_dir / "boards-decoded.json").read_text(encoding="utf-8"))
    return player_ids_from_boards(boards)


def load_briefs(path: Path) -> dict[str, dict]:
    if not path.exists():
        return {}
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]
    return {str(row["id"]): row for row in rows}


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", required=True, help="crawl run dir to backfill")
    parser.add_argument("--profile", default=".tmp/p545")
    parser.add_argument("--url", default="https://hauntedroomvnh5.joynetgame.com/")
    parser.add_argument("--browser", default="chrome")
    parser.add_argument("--settle", type=float, default=6.0,
                        help="seconds to let the lobby WS settle after login")
    parser.add_argument("--guilds", action="store_true",
                        help="also pull 0x24/0x0035 guild briefs for every "
                             "guild in guild-scores.json -> guild-names.json")
    args = parser.parse_args()

    run_dir = Path(args.run)
    players_path = run_dir / "players.jsonl"
    guild_ids: list[int] = []
    if args.guilds:
        scores = json.loads(
            (run_dir / "guild-scores.json").read_text(encoding="utf-8"))
        factions = scores.get("factions", scores)
        guild_ids = sorted({g["guild_id"] for d in factions.values()
                            for g in d["guilds"]})
    briefs_before = load_briefs(players_path)
    wanted = sorted(rank_ids(run_dir) - set(briefs_before), key=int)
    if wanted:
        print(f"[backfill] {len(wanted)} ids without brief (of {len(wanted) + len(briefs_before)})")
    elif not guild_ids:
        print("[backfill] nothing missing — every rank id already has a brief")
        return
    else:
        print("[backfill] briefs complete — only pulling guild names")

    out_dir = run_dir / "backfill"
    out_dir.mkdir(exist_ok=True)
    profile = Path(args.profile)
    if not acquire_profile_lock(profile, LOCK_FILENAME):
        print(f"[lock] {profile} is busy ({LOCK_FILENAME} held) — refusing to run")
        return
    try:
        entry_stages = [stage for stage in STAGES if stage[0] == "login"]
        writer = FrameWriter(out_dir)
        router = CrawlRouter(writer)

        def on_websocket(ws: WebSocket) -> None:
            print(f"[ws open] {ws.url}", flush=True)
            router.attach(ws, ws.url)

        async with async_playwright() as playwright, open_game_session(
            playwright, profile=profile, url=args.url,
            on_page=lambda p: p.on("websocket", on_websocket),
            browser=args.browser,
        ) as page:
            await asyncio.sleep(args.settle)
            await run_stages(page, writer, out_dir, entry_stages)
            # Refused ids are a server-side cooldown, not a hard block
            # (2026-10-27: 16 ids empty across 5 rounds, all back in
            # one dedicated batch ~90min later) — a later --guilds run
            # closes whatever gap this pass leaves.
            got = still_missing = 0
            if wanted:
                print(f"[backfill] asking {len(wanted)} ids", flush=True)
                await fetch_player_briefs(
                    page, router, wanted, chunk=BRIEF_CHUNK, retry_chunk=BRIEF_CHUNK,
                    rounds=ROUNDS - 1, pace=REQUEST_PACE)
                got = sum(1 for pid in wanted if pid in router.briefs)
                merged = {**briefs_before, **router.briefs}
                with players_path.open("w", encoding="utf-8") as fh:
                    for pid in sorted(merged, key=int):
                        fh.write(json.dumps(merged[pid], ensure_ascii=False) + "\n")
                still_missing = len([p for p in wanted if p not in router.briefs])
                print(f"[done] backfilled {got}/{len(wanted)}; "
                      f"players.jsonl now {len(merged)} rows; "
                      f"still missing: {still_missing}", flush=True)

            if guild_ids:
                # 0x24/0x0035 empty responses are time-gated, not
                # permanent (2026-10-27: 16 guilds empty at 07:26+07:45,
                # all 12 still-missing ones returned full briefs the
                # same afternoon — dead_guild_probe). So: merge into the
                # existing file and never overwrite a known name with a
                # null result — a later run (or warm server cache)
                # closes the rest.
                names_path = run_dir / "guild-names.json"
                names: dict = {}
                if names_path.exists():
                    try:
                        names = json.loads(
                            names_path.read_text(encoding="utf-8"))
                    except (OSError, ValueError):
                        names = {}
                answered = await fetch_guild_briefs(
                    page, router, guild_ids, pace=REQUEST_PACE)
                named = {gid: b for gid, b in answered.items() if b.get("name")}
                names.update(named)
                filled = len(named)
                names_path.write_text(
                    json.dumps(names, ensure_ascii=False, indent=1),
                    encoding="utf-8")
                print(f"[done] guild briefs {filled}/{len(guild_ids)} filled, "
                      f"{sum(1 for v in names.values() if v.get('name'))}"
                      f"/{len(guild_ids)} named total", flush=True)
    finally:
        release_profile_lock(profile, LOCK_FILENAME)


if __name__ == "__main__":
    asyncio.run(main())
