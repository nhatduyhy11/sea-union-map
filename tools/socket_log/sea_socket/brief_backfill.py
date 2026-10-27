"""Backfill missing player briefs for an existing sea crawl run.

The crawler's brief phase has no retry (crawler.py brief loop), so one
throttled batch (server answers 0x0d/0x0020 with an empty list — seen as
seq=169: 60 ids -> 0 briefs) leaves those players nameless in players.jsonl
forever. This tool re-opens the session, asks ONLY the missing ids, and
merges the answers back into the run's players.jsonl. No map crawl.

    uv run python tools/socket_log/sea_socket/brief_backfill.py \
        --run .tmp/sea-crawl/sea-crawl-<ts> --profile .tmp/pmain

Files touched: <run>/players.jsonl (merged in place); WS evidence goes to
<run>/backfill/ so the original capture stays intact.
"""

import argparse
import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from playwright.async_api import Page, WebSocket, async_playwright

from browser.navigation import navigate_to_game  # noqa: E402
from browser.page_guards import (  # noqa: E402
    install_game_core_frame_guard_after_delay,
    install_profile_popup_guard,
)
from browser.process_guard import acquire_profile_lock, release_profile_lock  # noqa: E402
from capture.capture import FrameWriter  # noqa: E402
from core.protocol import (  # noqa: E402
    GUILD_BRIEF_CMD,
    GUILD_MODULE,
    parse_guild_brief,
    parse_player_briefs,
)
from core.runner import SEND_FRAME_JS, WS_SEND_HOOK_JS  # noqa: E402
from sea_socket.crawler import CrawlRouter, LOCK_FILENAME  # noqa: E402
from sea_socket.walkthrough import STAGES, run_stages  # noqa: E402
from sea_socket.protocol import build_brief_frame  # noqa: E402

# Throttle evidence (2026-10-27): the crawler's 60-id batches mostly answered
# 60/60, but one came back empty — smaller chunks + pacing dodge it.
BRIEF_CHUNK = 20
REQUEST_PACE = 0.4
ROUNDS = 5  # whole-pass retries for the still-missing tail


def rank_ids(run_dir: Path) -> set[str]:
    boards = json.loads((run_dir / "boards-decoded.json").read_text(encoding="utf-8"))
    ids: set[str] = set()
    for row in boards.values():
        for entry in row.get("rows", []):
            if entry.get("id_type") == 1:  # skip faction pseudo-rows (ids 1..4)
                ids.add(str(entry["player_id"]))
        if row.get("self"):
            ids.add(str(row["self"]["player_id"]))
    return ids


def load_briefs(path: Path) -> dict[str, dict]:
    if not path.exists():
        return {}
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]
    return {str(row["id"]): row for row in rows}


async def brief_pass(page: Page, router: CrawlRouter, wanted: list[str],
                     chunk: int) -> None:
    """One pass of brief requests; router.briefs accumulates whatever returns."""
    loop = asyncio.get_running_loop()
    for start in range(0, len(wanted), chunk):
        batch = wanted[start : start + chunk]
        seq = router.next_seq()
        fut: asyncio.Future = loop.create_future()
        router.pending[seq] = fut
        await page.evaluate(SEND_FRAME_JS, list(build_brief_frame(seq, batch)))
        try:
            await asyncio.wait_for(fut, 8.0)
        except asyncio.TimeoutError:
            router.pending.pop(seq, None)
            print(f"[briefs] timeout for {len(batch)} ids", flush=True)
        await asyncio.sleep(REQUEST_PACE)


async def run_backfill(page: Page, router: CrawlRouter, wanted: list[str]) -> int:
    for attempt in range(1, ROUNDS + 1):
        missing = [pid for pid in wanted if pid not in router.briefs]
        if not missing:
            break
        print(f"[round {attempt}] asking {len(missing)} ids", flush=True)
        await brief_pass(page, router, missing, BRIEF_CHUNK)
        still = [pid for pid in wanted if pid not in router.briefs]
        if still:
            wait = min(2 ** (attempt - 1), 8.0)
            print(f"[round {attempt}] {len(still)} still missing — backoff {wait:.0f}s",
                  flush=True)
            await asyncio.sleep(wait)
    return sum(1 for pid in wanted if pid in router.briefs)


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", required=True, help="crawl run dir to backfill")
    parser.add_argument("--profile", default=".tmp/pmain")
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

        async with async_playwright() as playwright:
            context = await playwright.chromium.launch_persistent_context(
                user_data_dir=str(profile),
                channel=args.browser if args.browser != "chromium" else None,
                viewport={"width": 640, "height": 720},
                args=["--disable-blink-features=AutomationControlled",
                      "--hide-crash-restore-bubble"],
                service_workers="block",
            )
            try:
                page = context.pages[0] if context.pages else await context.new_page()

                async def prepare(new_page: Page) -> None:
                    await install_profile_popup_guard(new_page)
                    await new_page.add_init_script(WS_SEND_HOOK_JS)

                def on_websocket(ws: WebSocket) -> None:
                    print(f"[ws open] {ws.url}", flush=True)
                    router.attach(ws, ws.url)

                page.on("websocket", on_websocket)
                context.on("page", lambda p: p.on("websocket", on_websocket))
                page = await navigate_to_game(context, page, args.url, prepare_page=prepare)
                try:
                    await page.evaluate(WS_SEND_HOOK_JS)
                except Exception:  # noqa: BLE001 — heartbeats retrigger the send hook
                    pass
                guard_task = asyncio.create_task(
                    install_game_core_frame_guard_after_delay(page))
                await asyncio.sleep(args.settle)

                try:
                    await run_stages(page, writer, out_dir, entry_stages)
                    # Refused ids are a server-side cooldown, not a hard block
                    # (2026-10-27: 16 ids empty across 5 rounds, all back in
                    # one dedicated batch ~90min later) — a later --guilds run
                    # closes whatever gap this pass leaves.
                    got = still_missing = 0
                    if wanted:
                        got = await run_backfill(page, router, wanted)
                        merged = {**briefs_before, **router.briefs}
                        with players_path.open("w", encoding="utf-8") as fh:
                            for pid in sorted(merged, key=int):
                                fh.write(json.dumps(merged[pid], ensure_ascii=False) + "\n")
                        still_missing = len([p for p in wanted if p not in router.briefs])
                        print(f"[done] backfilled {got}/{len(wanted)}; "
                              f"players.jsonl now {len(merged)} rows; "
                              f"still missing: {still_missing}", flush=True)

                    if guild_ids:
                        names = {}
                        for gid in guild_ids:
                            try:
                                _h, body = await router.inject(
                                    page, GUILD_MODULE, GUILD_BRIEF_CMD, [(1, gid)])
                                names[str(gid)] = parse_guild_brief(body)
                            except RuntimeError as exc:
                                print(f"[guild] {gid}: {exc}", flush=True)
                            await asyncio.sleep(0.3)
                        (run_dir / "guild-names.json").write_text(
                            json.dumps(names, ensure_ascii=False, indent=1),
                            encoding="utf-8")
                        print(f"[done] guild briefs for {len(names)}/{len(guild_ids)} guilds",
                              flush=True)
                finally:
                    guard_task.cancel()
            finally:
                await context.close()
    finally:
        release_profile_lock(profile, LOCK_FILENAME)


if __name__ == "__main__":
    asyncio.run(main())
