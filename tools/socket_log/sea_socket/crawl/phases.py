"""Crawl phases, in run order: entry -> snapshot -> nodes -> boards -> guilds -> briefs.

Each phase injects through CrawlRouter and writes its own output file under
out_dir; run_crawl() chains them after an entry (payload_entry, or the GUI
stages in walkthrough.py) has made the server push the 0x72/0x000c snapshot.
"""

import asyncio
import base64
import json
from datetime import datetime
from pathlib import Path

from playwright.async_api import Page

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

SNAPSHOT_TIMEOUT = 20.0
FACTION_IDS = (1, 2, 3, 4)


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")


async def fail_with_screenshot(page: Page, out_dir: Path, name: str, message: str):
    """Save screens/FAIL-<name>.png (same place as walkthrough stage failures) and raise."""
    fail = out_dir / "screens" / f"FAIL-{name}.png"
    await page.screenshot(path=str(fail))
    raise RuntimeError(f"{message}; evidence: {fail}")


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
        await fail_with_screenshot(page, out_dir, "no-login",
                                   f"no 0x72/0x0002 within {login_timeout}s")
    await asyncio.sleep(0.5)  # let the rest of the boot block land
    _h, body = await router.inject(page, SEA_MODULE, BATTLEFIELD_CMD, [])
    if router.map_snapshot is None:  # route() parse sẵn rồi; fallback cho chắc
        router.map_snapshot = parse_map_snapshot(body)
    _h, body = await router.inject(page, SEA_MODULE, STANDINGS_CMD, [])
    standings = parse_standings(body)
    write_json(out_dir / "standings.json", standings)
    print(f"[entry] payload: fuel={[(r.get('f1'), r.get('f2')) for r in standings]}",
          flush=True)


async def wait_snapshot(page: Page, router: CrawlRouter, out_dir: Path) -> dict:
    """Wait for the 0x72/0x000c snapshot (pushed by either entry) -> map-snapshot.json."""
    loop = asyncio.get_running_loop()
    deadline = loop.time() + SNAPSHOT_TIMEOUT
    while router.map_snapshot is None and loop.time() < deadline:
        await asyncio.sleep(0.5)
    if router.map_snapshot is None:
        await fail_with_screenshot(page, out_dir, "no-snapshot",
                                   f"no 0x72/0x000c snapshot within {SNAPSHOT_TIMEOUT}s")
    snapshot = router.map_snapshot
    print(f"[snapshot] {len(snapshot['nodes'])} nodes, owners={snapshot['owner_counts']}",
          flush=True)
    write_json(out_dir / "map-snapshot.json", snapshot)
    return snapshot


async def crawl_nodes(page: Page, router: CrawlRouter, out_dir: Path,
                      node_ids: list[int]) -> dict[str, int]:
    """Per node: state (0x72/0x0011) + board 118 -> node-states.jsonl, node-boards.jsonl.

    Lines are flushed per node so a crash mid-crawl keeps what was pulled.
    """
    logged_at = datetime.now().astimezone().isoformat()
    counts = {"states": 0, "boards": 0, "throttle_retries": 0}
    with (out_dir / "node-states.jsonl").open("w", encoding="utf-8") as states_fh, \
            (out_dir / "node-boards.jsonl").open("w", encoding="utf-8") as boards_fh:
        for node_id in node_ids:
            header, body, retries = await inject_retrying(
                page, router, SEA_MODULE, NODE_STATE_CMD, [(1, node_id)], state_throttled)
            counts["throttle_retries"] += retries
            state = parse_node_state(body, requested_id=node_id)
            states_fh.write(json.dumps(
                {**state, "compress": header["status"], "logged_at": logged_at},
                ensure_ascii=False) + "\n")
            states_fh.flush()
            counts["states"] += 1
            router.node_states[node_id] = state

            header, body, retries = await inject_retrying(
                page, router, RANK_MODULE, RANK_CMD,
                [(1, RANK_NODE), (2, node_id)], board_throttled)
            counts["throttle_retries"] += retries
            compress = header["status"] == 1
            router.board_bodies[(RANK_NODE, node_id)] = (body, compress)
            boards_fh.write(json.dumps(
                {"kind": "node", "node_id": node_id, "compress": compress,
                 "body_b64": base64.b64encode(body).decode(), "logged_at": logged_at},
                ensure_ascii=False) + "\n")
            boards_fh.flush()
            counts["boards"] += 1
            await asyncio.sleep(REQUEST_PACE)
    print(f"[crawl] {counts['states']} node states, {counts['boards']} boards, "
          f"{counts['throttle_retries']} throttle retries", flush=True)
    return counts


async def fetch_global_boards(page: Page, router: CrawlRouter) -> None:
    """Faction (116) + player (117) boards into router.board_bodies, keyed (kind, 0)."""
    for kind in (RANK_FACTION, RANK_PLAYER):
        header, body = await router.inject(page, RANK_MODULE, RANK_CMD, [(1, kind)])
        router.board_bodies[(kind, 0)] = (body, header["status"] == 1)


async def fetch_faction_details(page: Page, router: CrawlRouter, out_dir: Path) -> dict:
    """Guild scores (Tổng quan phe, 0x72/0x0024 -> 0x0025) -> guild-scores.json.

    The only server source of per-guild ST totals — the web faction board uses
    it directly instead of summing node rows (LEADERBOARD_SPECS.md §1.3).
    """
    details = {}
    for faction_id in FACTION_IDS:
        _h, body = await router.inject(page, SEA_MODULE, FACTION_DETAIL_CMD, [(1, faction_id)])
        details[faction_id] = parse_faction_detail(body)
        await asyncio.sleep(REQUEST_PACE)
    write_json(out_dir / "guild-scores.json", details)
    return details


async def fetch_guild_names(page: Page, router: CrawlRouter, out_dir: Path,
                            faction_details: dict) -> None:
    """Guild brief for every guild in faction_details -> guild-names.json."""
    guild_ids = sorted({g["guild_id"]
                        for detail in faction_details.values()
                        for g in detail["guilds"]})
    write_json(out_dir / "guild-names.json",
               await fetch_guild_briefs(page, router, guild_ids))


async def decode_all_boards(page: Page, router: CrawlRouter, out_dir: Path) -> dict:
    """Every collected board through the game runtime -> boards-decoded.json."""
    decoded = await decode_boards(page, router.board_bodies)
    write_json(out_dir / "boards-decoded.json", {str(k): v for k, v in decoded.items()})
    return decoded


async def fetch_players(page: Page, router: CrawlRouter, out_dir: Path,
                        decoded_boards: dict) -> None:
    """Player briefs for every rankId seen in any board -> players.jsonl."""
    await fetch_player_briefs(
        page, router, sorted(player_ids_from_boards(decoded_boards), key=int))
    with (out_dir / "players.jsonl").open("w", encoding="utf-8") as fh:
        for player_id in sorted(router.briefs):
            fh.write(json.dumps(router.briefs[player_id], ensure_ascii=False) + "\n")


def rollup_factions(states: dict[int, dict]) -> dict[int, int]:
    totals: dict[int, int] = {}
    for state in states.values():
        for faction, score in state["faction_scores"].items():
            totals[faction] = totals.get(faction, 0) + score
    return totals


async def run_crawl(page: Page, router: CrawlRouter, out_dir: Path) -> dict:
    """Snapshot -> per-node pulls -> top boards -> guilds -> name briefs -> summary.json."""
    snapshot = await wait_snapshot(page, router, out_dir)
    node_ids = sorted(n["id"] for n in snapshot["nodes"])
    counts = await crawl_nodes(page, router, out_dir, node_ids)
    await fetch_global_boards(page, router)
    faction_details = await fetch_faction_details(page, router, out_dir)
    await fetch_guild_names(page, router, out_dir, faction_details)
    decoded_boards = await decode_all_boards(page, router, out_dir)
    await fetch_players(page, router, out_dir, decoded_boards)

    summary = {
        "nodes": len(node_ids),
        **counts,
        "briefs": len(router.briefs),
        "owner_counts": snapshot["owner_counts"],
        "per_faction_scores": rollup_factions(router.node_states),
    }
    write_json(out_dir / "summary.json", summary)
    return summary
