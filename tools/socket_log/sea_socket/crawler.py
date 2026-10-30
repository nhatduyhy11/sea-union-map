"""Payload-driven SEA crawler: enumerate the battle map and pull every node by id.

The GUI walkthrough (walkthrough.py) only proves the protocol; this crawler is
the real collector. Entry has two modes (docs/sea/EVENT_NAVIGATE_DECODE.md):

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

Injected requests use ssid bytes 0xF0..0xFF (core.protocol.INJECT_SEQ
convention): the server echoes the ssid in the response header, the game client
ignores stray replies, so responses correlate by ssid. Board bodies carry the
compress flag (response header byte 7); they are decoded with
the game's own runtime (QuickLZ + BufferUtils via window.__require) in the live
page — same approach as core/runtime_codec.py.

Outputs under --out (default .tmp/sea-crawl/sea-crawl-<ts>):
    map-snapshot.json    89 nodes {id, owner} + factions + guild roster
    standings.json       0x001c: nhiên liệu/rank/owned 4 phe (payload entry)
    node-states.jsonl    per-node art + faction ST scores
    node-boards.jsonl    per-node leaderboard bodies (b64, evidence)
    boards-decoded.json  every board decoded via the game runtime
    players.jsonl        id -> name/guild/power/server briefs
    summary.json         counts + per-faction score rollup

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
"""

import argparse
import asyncio
import base64
import json
import sys
from datetime import datetime
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from playwright.async_api import Page, WebSocket, async_playwright

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from browser.process_guard import acquire_profile_lock, release_profile_lock
from browser.session import open_game_session
from capture.frames import FrameWriter
from sea_socket.crawl import LOCK_FILENAME
from sea_socket.crawl.board_codec import decode_boards
from sea_socket.crawl.briefs import (
    fetch_guild_briefs,
    fetch_player_briefs,
    player_ids_from_boards,
)
from sea_socket.crawl.router import (
    REQUEST_PACE,
    CrawlRouter,
    board_throttled,
    inject_retrying,
    state_throttled,
)
from sea_socket.protocol import (
    BATTLEFIELD_CMD,
    FACTION_DETAIL_CMD,
    NODE_STATE_CMD,
    RANK_CMD,
    RANK_FACTION,
    RANK_MODULE,
    RANK_NODE,
    RANK_PLAYER,
    SEA_MODULE,
    STANDINGS_CMD,
    parse_faction_detail,
    parse_map_snapshot,
    parse_node_state,
    parse_standings,
)
from sea_socket.report import DEV_DUMP_OUT, dump_run
from sea_socket.walkthrough import STAGES, run_stages

SNAPSHOT_TIMEOUT = 20.0


def rollup_factions(states: dict[int, dict]) -> dict[int, int]:
    totals: dict[int, int] = {}
    for state in states.values():
        for faction, score in state["faction_scores"].items():
            totals[faction] = totals.get(faction, 0) + score
    return totals


async def payload_entry(page: Page, router: CrawlRouter, out_dir: Path,
                        login_timeout: float) -> None:
    """E2 — wait-login + inject thay 3 stage GUI (docs/sea/EVENT_NAVIGATE_DECODE.md).

    Chờ response 0x72/0x0002 đầu tiên (boot sync xong; heartbeat muộn hơn ~2.6s
    nên không dùng), +0.5s cho nốt boot block, rồi inject 0x000b (snapshot 89
    node) + 0x001b (bảng 4 phe) từ Home — 0 click, không phụ thuộc screen.
    """
    loop = asyncio.get_running_loop()
    deadline = loop.time() + login_timeout
    while router.login_done_ms is None and loop.time() < deadline:
        await asyncio.sleep(0.2)
    if router.login_done_ms is None:
        fail = out_dir / "FAIL-no-login.png"
        await page.screenshot(path=str(fail))
        raise RuntimeError(f"no 0x72/0x0002 within {login_timeout}s; evidence: {fail}")
    await asyncio.sleep(0.5)  # let the rest of the boot block land
    _h, body = await router.inject(page, SEA_MODULE, BATTLEFIELD_CMD, [])
    if router.map_snapshot is None:  # route() parse sẵn rồi; fallback cho chắc
        router.map_snapshot = parse_map_snapshot(body)
    _h, body = await router.inject(page, SEA_MODULE, STANDINGS_CMD, [])
    standings = parse_standings(body)
    (out_dir / "standings.json").write_text(
        json.dumps(standings, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"[entry] payload: fuel={[(r.get('f1'), r.get('f2')) for r in standings]}",
          flush=True)


async def run_crawl(page: Page, router: CrawlRouter, out_dir: Path) -> dict:
    """Snapshot -> per-node pulls -> top boards -> name briefs -> files."""
    loop = asyncio.get_running_loop()
    deadline = loop.time() + SNAPSHOT_TIMEOUT
    while router.map_snapshot is None and loop.time() < deadline:
        await asyncio.sleep(0.5)
    if router.map_snapshot is None:
        fail = out_dir / "screens" / "FAIL-no-snapshot.png"
        await page.screenshot(path=str(fail))
        raise RuntimeError(f"no 0x72/0x000c snapshot within {SNAPSHOT_TIMEOUT}s; evidence: {fail}")
    snapshot = router.map_snapshot
    node_ids = sorted(n["id"] for n in snapshot["nodes"])
    print(f"[snapshot] {len(node_ids)} nodes, owners={snapshot['owner_counts']}", flush=True)
    (out_dir / "map-snapshot.json").write_text(
        json.dumps(snapshot, ensure_ascii=False, indent=1), encoding="utf-8"
    )

    logged_at = datetime.now().astimezone().isoformat()
    states_count = boards_count = throttle_hits = 0
    states_path = out_dir / "node-states.jsonl"
    boards_path = out_dir / "node-boards.jsonl"

    with states_path.open("w", encoding="utf-8") as states_fh, \
            boards_path.open("w", encoding="utf-8") as boards_fh:
        for node_id in node_ids:
            header, body, retries = await inject_retrying(
                page, router, SEA_MODULE, NODE_STATE_CMD, [(1, node_id)], state_throttled)
            throttle_hits += retries
            state = parse_node_state(body, requested_id=node_id)
            states_fh.write(json.dumps(
                {**state, "compress": header["status"], "logged_at": logged_at},
                ensure_ascii=False) + "\n")
            states_fh.flush()
            states_count += 1
            router.node_states[node_id] = state

            header, body, retries = await inject_retrying(
                page, router, RANK_MODULE, RANK_CMD,
                [(1, RANK_NODE), (2, node_id)], board_throttled)
            throttle_hits += retries
            compress = header["status"] == 1
            router.board_bodies[(RANK_NODE, node_id)] = (body, compress)
            boards_fh.write(json.dumps(
                {"kind": "node", "node_id": node_id, "compress": compress,
                 "body_b64": base64.b64encode(body).decode(), "logged_at": logged_at},
                ensure_ascii=False) + "\n")
            boards_fh.flush()
            boards_count += 1
            await asyncio.sleep(REQUEST_PACE)
    print(f"[crawl] {states_count} node states, {boards_count} boards", flush=True)

    for kind in (RANK_FACTION, RANK_PLAYER):
        header, body = await router.inject(page, RANK_MODULE, RANK_CMD, [(1, kind)])
        router.board_bodies[(kind, 0)] = (body, header["status"] == 1)

    # Guild scores (Tổng quan phe, 0x72/0x0024 -> 0x0025): the only server
    # source of per-guild ST totals — the web faction board uses it directly
    # instead of summing node rows (LEADERBOARD_SPECS.md §1.3).
    faction_details = {}
    for faction_id in (1, 2, 3, 4):
        header, body = await router.inject(
            page, SEA_MODULE, FACTION_DETAIL_CMD, [(1, faction_id)])
        detail = parse_faction_detail(body)
        faction_details[faction_id] = detail
        await asyncio.sleep(REQUEST_PACE)
    (out_dir / "guild-scores.json").write_text(
        json.dumps(faction_details, ensure_ascii=False, indent=1),
        encoding="utf-8")

    guild_ids = sorted({g["guild_id"]
                        for detail in faction_details.values()
                        for g in detail["guilds"]})
    guild_briefs = await fetch_guild_briefs(page, router, guild_ids)
    (out_dir / "guild-names.json").write_text(
        json.dumps(guild_briefs, ensure_ascii=False, indent=1),
        encoding="utf-8")

    decoded_boards = await decode_boards(page, router.board_bodies)
    (out_dir / "boards-decoded.json").write_text(
        json.dumps({str(k): v for k, v in decoded_boards.items()},
                   ensure_ascii=False, indent=1),
        encoding="utf-8",
    )

    # Player briefs for every rankId seen in any board (ssid-tracked batches).
    await fetch_player_briefs(
        page, router, sorted(player_ids_from_boards(decoded_boards), key=int))

    players_path = out_dir / "players.jsonl"
    with players_path.open("w", encoding="utf-8") as fh:
        for player_id in sorted(router.briefs):
            fh.write(json.dumps(router.briefs[player_id], ensure_ascii=False) + "\n")

    summary = {
        "nodes": len(node_ids),
        "states": states_count,
        "boards": boards_count,
        "briefs": len(router.briefs),
        "owner_counts": snapshot["owner_counts"],
        "per_faction_scores": rollup_factions(router.node_states),
    }
    (out_dir / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    return summary


async def main() -> None:
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
    args = parser.parse_args()

    started_at = datetime.now().astimezone()
    out_dir = (Path(args.out) if args.out
               else Path(".tmp/sea-crawl") / f"sea-crawl-{started_at:%Y%m%d-%H%M%S}")
    out_dir.mkdir(parents=True, exist_ok=True)
    profile = Path(args.profile)
    if not acquire_profile_lock(profile, LOCK_FILENAME):
        print(f"[lock] {profile} is busy ({LOCK_FILENAME} held) — refusing to run")
        return
    try:
        # login -> open-sea -> battle-map: the map-open click is what triggers the
        # server's 0x72/0x000c full snapshot the crawl phase enumerates from.
        entry_stages = [stage for stage in STAGES
                        if stage[0] in ("login", "open-sea", "battle-map")]
        (out_dir / "meta.json").write_text(json.dumps({
            "url": args.url, "profile": args.profile,
            "started_at": started_at.isoformat(),
            "entry": "gui" if args.gui_entry else "payload",
            "stages": [name for name, _ in entry_stages] if args.gui_entry else [],
        }, indent=2), encoding="utf-8")
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
                    dump_run(out_dir, out=DEV_DUMP_OUT)
                except SystemExit as exc:
                    # Raw run đã an toàn trên đĩa — chỉ nhắc chỗ re-dump.
                    print(f"[dump] transform failed, raw run kept at "
                          f"{out_dir}: {exc}", flush=True)
                    raise
    finally:
        release_profile_lock(profile, LOCK_FILENAME)


if __name__ == "__main__":
    asyncio.run(main())
