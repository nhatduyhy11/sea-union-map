"""Payload-driven SEA crawler: enumerate the battle map and pull every node by id.

The GUI walkthrough (walkthrough.py) only proves the protocol; this crawler is
the real collector. Entry has two modes (request key: docs/sea/SOCKET_PROTOCOL.md §4.2):

    payload (mặc định) — wait_login_done (response 0x72/0x0002 đầu tiên) rồi
      inject 0x72/0x000b từ Home: snapshot ~9–13s sau nav, 0 click, không phụ
      thuộc screen/loading; kèm 0x72/0x001b -> standings.json (bảng 4 phe).
    --gui-entry — replay 3 stage cũ (login -> open-sea -> battle-map), fallback.

Sau entry, crawl loop inject per-node requests straight into the game socket,
zero map interaction:

    0x72/0x0011 {f1: id}        -> 0x0012  node state (art, faction ST scores)
    0x0c/0x0002 {f1:118, f2:id} -> 0x0003  node leaderboard (QuickLZ-compressed)
    0x0c/0x0002 {f1:116/117}    -> 0x0003  faction / player leaderboard
    0x0d/0x001f {packed ids}    -> 0x0020  player briefs (name/guild/power)

Engine lives in sea_socket/crawl/ (router, board_codec, briefs, phases); this
file is only the CLI: args, profile lock, session, entry, crawl, dump.

Outputs under --out (default .tmp/sea-crawl/sea-crawl-<ts>):
    meta.json            url/profile/started_at + entry mode
    map-snapshot.json    89 nodes {id, owner} + factions + guild roster
    standings.json       0x001c: nhiên liệu/rank/owned 4 phe (payload entry)
    node-states.jsonl    per-node art + faction ST scores
    node-boards.jsonl    per-node leaderboard bodies (b64, evidence)
    guild-scores.json    0x0025 per-faction guild ST totals
    guild-names.json     0x0036 guild briefs (name/members/power)
    boards-decoded.json  every board decoded via the game runtime
    players.jsonl        id -> name/guild/power/server briefs
    summary.json         counts + throttle retries + per-faction score rollup
    screens/FAIL-*.png   evidence when an entry/snapshot wait times out

With --dump (default on) the run is transformed right after crawl via
sea_socket.report.dump_run — one command yields both the raw run and the FE
JSON at public/sea-live-dev.json (refresh browser to see it). --no-dump keeps
just the raw run; report.py stays the standalone CLI to re-dump old runs or
bake src/data/sea-live.json.

Usage:
    uv run python tools/socket_log/sea_socket/crawler.py --profile .tmp/p545
    uv run python tools/socket_log/sea_socket/crawler.py --profile .tmp/p545 --headless
    uv run python tools/socket_log/sea_socket/crawler.py --profile .tmp/p545 --no-dump
    uv run python tools/socket_log/sea_socket/crawler.py --profile .tmp/p545 --gui-entry
    uv run python tools/socket_log/sea_socket/crawler.py --profile .tmp/p545 --dump-out out/other.json
"""

import argparse
import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from playwright.async_api import WebSocket, async_playwright

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from browser.process_guard import acquire_profile_lock, release_profile_lock
from browser.session import open_game_session
from capture.frames import FrameWriter
from sea_socket.crawl import LOCK_FILENAME
from sea_socket.crawl.phases import payload_entry, run_crawl
from sea_socket.crawl.router import CrawlRouter
from sea_socket.report import DEV_DUMP_OUT, dump_run
from sea_socket.walkthrough import STAGES, run_stages

# --gui-entry: login -> open-sea -> battle-map; the map-open click is what
# triggers the server's 0x72/0x000c full snapshot the crawl enumerates from.
GUI_ENTRY_STAGES = ("login", "open-sea", "battle-map")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--profile", default=".tmp/p545")
    parser.add_argument("--url", default="https://hauntedroomvnh5.joynetgame.com/")
    parser.add_argument("--out", default=None,
                        help="Output dir (default .tmp/sea-crawl/sea-crawl-<ts>)")
    parser.add_argument("--settle", type=float, default=8.0,
                        help="--gui-entry: giây chờ game ổn định trước khi replay stage")
    parser.add_argument("--gui-entry", action="store_true",
                        help="Replay 3 stage GUI cũ (login/open-sea/battle-map) thay "
                             "payload entry mặc định (wait-login + inject, 0 click)")
    parser.add_argument("--login-timeout", type=float, default=90.0,
                        help="Payload entry: giây chờ signal login R 0x72/0x0002")
    parser.add_argument("--width", type=int, default=640)
    parser.add_argument("--height", type=int, default=720)
    parser.add_argument("--browser", default="chrome")
    parser.add_argument("--headless", action="store_true")
    parser.add_argument("--dump", action=argparse.BooleanOptionalAction, default=True,
                        help="Transform run vừa crawl thành JSON cho FE ngay sau "
                             "khi crawl (mặc định bật; tắt bằng --no-dump)")
    parser.add_argument("--dump-out", default=None, type=Path,
                        help="Đích JSON khi --dump (mặc định public/sea-live-dev.json)")
    return parser.parse_args()


def write_meta(out_dir: Path, args: argparse.Namespace, started_at: datetime,
               entry_stages: list[tuple[str, list[str]]]) -> None:
    (out_dir / "meta.json").write_text(json.dumps({
        "url": args.url, "profile": args.profile,
        "started_at": started_at.isoformat(),
        "entry": "gui" if args.gui_entry else "payload",
        "stages": [name for name, _ in entry_stages],
    }, indent=2), encoding="utf-8")


async def main() -> None:
    args = parse_args()
    started_at = datetime.now().astimezone()
    out_dir = (Path(args.out) if args.out
               else Path(".tmp/sea-crawl") / f"sea-crawl-{started_at:%Y%m%d-%H%M%S}")
    out_dir.mkdir(parents=True, exist_ok=True)
    profile = Path(args.profile)
    if not acquire_profile_lock(profile, LOCK_FILENAME):
        print(f"[lock] {profile} is busy ({LOCK_FILENAME} held) — refusing to run")
        return
    try:
        entry_stages = ([stage for stage in STAGES if stage[0] in GUI_ENTRY_STAGES]
                        if args.gui_entry else [])
        write_meta(out_dir, args, started_at, entry_stages)
        writer = FrameWriter(out_dir)
        router = CrawlRouter(writer)

        def on_websocket(ws: WebSocket) -> None:
            print(f"[ws open] {ws.url}", flush=True)
            router.attach(ws, ws.url)

        async with async_playwright() as playwright, open_game_session(
            playwright, profile=profile, url=args.url,
            on_page=lambda p: p.on("websocket", on_websocket),
            browser=args.browser, headless=args.headless,
            width=args.width, height=args.height,
        ) as page:
            if args.gui_entry:
                await asyncio.sleep(args.settle)
                await run_stages(page, writer, out_dir, entry_stages)
            else:
                await payload_entry(page, router, out_dir, args.login_timeout)
            summary = await run_crawl(page, router, out_dir)
            print(f"[done] {json.dumps(summary, ensure_ascii=False)}", flush=True)
            if args.dump:
                try:
                    dump_run(out_dir, out=args.dump_out or DEV_DUMP_OUT)
                except SystemExit as exc:
                    # Raw run đã an toàn trên đĩa — chỉ nhắc chỗ re-dump.
                    print(f"[dump] transform failed, raw run kept at "
                          f"{out_dir}: {exc}", flush=True)
                    raise
    finally:
        release_profile_lock(profile, LOCK_FILENAME)


if __name__ == "__main__":
    asyncio.run(main())
