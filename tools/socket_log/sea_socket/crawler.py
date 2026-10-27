"""Payload-driven SEA crawler: enumerate the battle map and pull every node by id.

The GUI walkthrough (walkthrough.py) only proves the protocol; this crawler is
the real collector. It boots the game headed, replays the login -> open-sea ->
battle-map stages once (the server hands over the full map snapshot 0x72/0x000c
on map open — 89 node ids + owners in one payload), then injects per-node
requests straight into the game socket, zero map interaction:

    0x72/0x0011 {f1: id}        -> 0x0012  node state (art, faction ST scores)
    0x0c/0x0002 {f1:118, f2:id} -> 0x0003  node leaderboard (QuickLZ-compressed)
    0x0c/0x0002 {f1:116/117}    -> 0x0003  faction / player leaderboard
    0x0d/0x001f {packed ids}    -> 0x0020  player briefs (name/guild/power)

Injected requests use ssid bytes 0xF0..0xFF (core.protocol.INJECT_SEQ
convention): the server echoes the ssid in the response header, the game client
ignores stray replies, so responses correlate by ssid. Board bodies carry the
compress flag (response header byte 7, commit f61dd7a); they are decoded with
the game's own runtime (QuickLZ + BufferUtils via window.__require) in the live
page — same approach as core/runtime_codec.py.

Outputs under --out (default .tmp/sea-crawl/sea-crawl-<ts>):
    map-snapshot.json    89 nodes {id, owner} + factions + guild roster
    node-states.jsonl    per-node art + faction ST scores
    node-boards.jsonl    per-node leaderboard bodies (b64, evidence)
    boards-decoded.json  every board decoded via the game runtime
    players.jsonl        id -> name/guild/power/server briefs
    summary.json         counts + per-faction score rollup

Usage:
    uv run python tools/socket_log/sea_socket/crawler.py --profile .tmp/pmain
    uv run python tools/socket_log/sea_socket/crawler.py --profile .tmp/pmain --headless
"""

import argparse
import asyncio
import base64
import json
import sys
from datetime import datetime
from pathlib import Path

from playwright.async_api import Page, WebSocket, async_playwright

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from browser.navigation import navigate_to_game  # noqa: E402
from browser.page_guards import (  # noqa: E402
    install_game_core_frame_guard_after_delay,
    install_profile_popup_guard,
)
from browser.process_guard import acquire_profile_lock, release_profile_lock  # noqa: E402
from capture.capture import FrameWriter  # noqa: E402
from core.decode import decode_proto  # noqa: E402
from core.protocol import parse_player_briefs  # noqa: E402
from core.runner import SEND_FRAME_JS, WS_SEND_HOOK_JS  # noqa: E402
from sea_socket.protocol import (  # noqa: E402
    MAP_SNAPSHOT_CMD,
    NODE_STATE_CMD,
    PLAYER_MODULE,
    RANK_CMD,
    RANK_FACTION,
    RANK_MODULE,
    RANK_NODE,
    RANK_PLAYER,
    SEA_MODULE,
    build_brief_frame,
    build_request,
    iter_frames,
    parse_map_snapshot,
    parse_node_state,
)
from sea_socket.walkthrough import STAGES, run_stages  # noqa: E402

BRIEF_CHUNK = 60  # client batches ~59 ids per request
INJECT_TIMEOUT = 8.0
REQUEST_PACE = 0.25  # seconds between injected requests
SNAPSHOT_TIMEOUT = 20.0
# Server throttles bursts of injected requests with err 10000035 (2026-10-26:
# ~57 requests pass, then blocks of ~5 rejections arrive at a duty cycle; the
# rejected set differs run to run while owners don't — quota, not node state).
# Anomalous responses get retried with backoff; a state answer without an f2
# node blob and a compressed board body under 24B are both throttle rejections.
THROTTLE_RETRY_ATTEMPTS = 5
LOCK_FILENAME = ".sea_crawler.lock"

# Board decode with the game's own codec (see core/runtime_codec.py DECODE_JS):
# QuickLZ when flagged, then BufferUtils.decode with the ranking schema def.
DECODE_BOARDS_JS = r"""
async (inputs) => {
  const RP  = window.__require('RankingProto');
  const RD  = window.__require('RankingDefine').RankingDefine;
  const GDP = window.__require('GameDefProto');
  const GDDm = window.__require('GameDefDefine');
  const GDD = GDDm.GameDefDefine || GDDm;
  const BU  = window.__require('BufferUtils').BufferUtils;
  const PBRm = window.__require('PBReader');
  const PBR = PBRm.PBReader || PBRm;
  const QLZm = window.__require('QuickLZ');
  const QLZ = QLZm.QuickLZ || QLZm;
  // Attach schema descriptors by name suffix across every proto export —
  // a direct property grab can miss and BU.decode then silently yields an
  // empty object (seen 2026-10-26: all boards decoded to 0 rows).
  for (const exports of [GDP, RP]) {
    if (!exports) continue;
    for (const clsName of Object.keys(exports)) {
      const defName = clsName + '_Def';
      if (typeof exports[clsName] === 'function') {
        const def = GDD[defName] || RD[defName];
        if (def) exports[clsName].getDefines = def;
      }
    }
  }
  const cls = RP.GetCommonRankR_Ranking_S2C;
  if (!cls.getDefines) throw new Error('Ranking_S2C schema def not found');
  return inputs.map(({b64, compress}) => {
    try {
      const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const plain = compress ? QLZ.decompress(raw) : raw;
      const vo = BU.decode(cls, PBR.create(plain));
      const ranks = vo.ranks || [];
      const n = ranks.length;
      const rows = [];
      for (let i = 0; i < n; i++) {
        const r = ranks.getValueByIndex ? ranks.getValueByIndex(i) : ranks[i];
        rows.push({rank: r.rank, score: r.key, player_id: String(r.rankId),
                   addition_info: r.additionInfo, id_type: r.idType});
      }
      return {err: vo.err !== undefined ? String(vo.err) : null,
              id_type: vo.idType,
              self: vo.selfRank ? {rank: vo.selfRank.rank, score: vo.selfRank.key,
                                   player_id: String(vo.selfRank.rankId),
                                   addition_info: vo.selfRank.additionInfo} : null,
              rows};
    } catch (exc) {
      return {error: String(exc)};
    }
  });
}
"""


class CrawlRouter:
    """Route WS frames: resolve pending injected requests + keep named datasets."""

    def __init__(self, writer: FrameWriter) -> None:
        self.writer = writer
        self.pending: dict[int, asyncio.Future] = {}
        self.seq = 0xF0  # INJECT_SEQ convention: game client ignores these replies
        self.map_snapshot: dict | None = None
        self.briefs: dict[str, dict] = {}
        self.node_states: dict[int, dict] = {}
        self.board_bodies: dict[tuple[int, int], tuple[bytes, bool]] = {}

    def next_seq(self) -> int:
        self.seq = self.seq % 0xFF + 1  # 0xF1..0xFF, then 0x01.. — never 0x00
        return self.seq

    async def inject(self, page: Page, module: int, cmd: int,
                     fields: list[tuple[int, int]]) -> tuple[dict, bytes]:
        seq = self.next_seq()
        fut: asyncio.Future = asyncio.get_running_loop().create_future()
        self.pending[seq] = fut
        frame = build_request(module, cmd, seq, fields)
        await self.writer.mark(f"inject:{module:02x}/{cmd:04x}:{fields}")
        sent = await page.evaluate(SEND_FRAME_JS, list(frame))
        if not sent:
            self.pending.pop(seq, None)
            raise RuntimeError("game socket not ready for injection")
        try:
            return await asyncio.wait_for(fut, INJECT_TIMEOUT)
        except asyncio.TimeoutError:
            self.pending.pop(seq, None)
            raise RuntimeError(
                f"no response to {module:02x}/{cmd:04x} seq={seq:#x} within {INJECT_TIMEOUT}s"
            ) from None

    def route(self, direction: str, payload) -> None:
        if direction != "R" or not isinstance(payload, bytes):
            return
        try:
            for header, body in iter_frames("R", payload):
                fut = self.pending.pop(header["seq"], None)
                if fut is not None and not fut.done():
                    fut.set_result((header, body))
                module, cmd = header["module"], header["cmd"]
                if module == SEA_MODULE and cmd == MAP_SNAPSHOT_CMD and self.map_snapshot is None:
                    self.map_snapshot = parse_map_snapshot(body)
                elif module == PLAYER_MODULE and cmd == 0x0020:
                    for brief in parse_player_briefs(body):
                        if brief.get("id") is not None:
                            self.briefs[str(brief["id"])] = brief
        except Exception as exc:  # noqa: BLE001 — a router bug must never kill the session
            print(f"[route] frame handling failed: {exc}", flush=True)

    def attach(self, ws: WebSocket, ws_url: str) -> None:
        ws.on("framereceived", lambda payload: (
            self.route("R", payload),
            asyncio.ensure_future(self.writer.write_frame("R", ws_url, payload)),
        ))
        ws.on("framesent", lambda payload: asyncio.ensure_future(
            self.writer.write_frame("S", ws_url, payload)))


async def inject_retrying(page: Page, router: CrawlRouter, module: int, cmd: int,
                          fields: list[tuple[int, int]], is_anomalous) -> tuple[dict, bytes, int]:
    """inject() with throttle backoff; returns (header, body, retries_used)."""
    retries = 0
    header, body = await router.inject(page, module, cmd, fields)
    while is_anomalous(header, body) and retries < THROTTLE_RETRY_ATTEMPTS:
        wait = min(2 ** retries, 10.0)
        retries += 1
        print(f"[throttle] {module:02x}/{cmd:04x} {fields} — retry {retries} in {wait:.0f}s",
              flush=True)
        await asyncio.sleep(wait)
        header, body = await router.inject(page, module, cmd, fields)
    return header, body, retries


def rollup_factions(states: dict[int, dict]) -> dict[int, int]:
    totals: dict[int, int] = {}
    for state in states.values():
        for faction, score in state["faction_scores"].items():
            totals[faction] = totals.get(faction, 0) + score
    return totals


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

    def state_throttled(_header, body) -> bool:
        return not any(field == 2 for field, _w, _v in decode_proto(body))

    def board_throttled(_header, body) -> bool:
        return len(body) < 24  # err body: 12B compressed; real boards ≥ 32B

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

    # Decode every collected board with the game runtime (single JS round-trip).
    inputs = [
        {"key": list(key), "b64": base64.b64encode(body).decode(), "compress": compress}
        for key, (body, compress) in router.board_bodies.items()
    ]
    decoded = await page.evaluate(DECODE_BOARDS_JS, inputs)
    decoded_boards = {tuple(item["key"]): row for item, row in zip(inputs, decoded)}
    for key, row in decoded_boards.items():
        if "error" in row:
            print(f"[board] {key}: decode error {row['error']}", flush=True)
    (out_dir / "boards-decoded.json").write_text(
        json.dumps({str(k): v for k, v in decoded_boards.items()},
                   ensure_ascii=False, indent=1),
        encoding="utf-8",
    )

    # Player briefs for every rankId seen in any board (ssid-tracked batches).
    ids = set()
    for row in decoded_boards.values():
        for entry in row.get("rows", []):
            ids.add(entry["player_id"])
        if row.get("self"):
            ids.add(row["self"]["player_id"])
    ordered = sorted(ids, key=int)
    for start in range(0, len(ordered), BRIEF_CHUNK):
        missing = [pid for pid in ordered[start : start + BRIEF_CHUNK] if pid not in router.briefs]
        if not missing:
            continue
        seq = router.next_seq()
        fut: asyncio.Future = loop.create_future()
        router.pending[seq] = fut
        await page.evaluate(SEND_FRAME_JS, list(build_brief_frame(seq, missing)))
        try:
            await asyncio.wait_for(fut, INJECT_TIMEOUT)
        except asyncio.TimeoutError:
            router.pending.pop(seq, None)
            print(f"[briefs] timeout for {len(missing)} ids", flush=True)
        await asyncio.sleep(REQUEST_PACE)

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
    parser.add_argument("--profile", default=".tmp/pmain")
    parser.add_argument("--url", default="https://hauntedroomvnh5.joynetgame.com/")
    parser.add_argument("--out", default=None,
                        help="Output dir (default .tmp/sea-crawl/sea-crawl-<ts>)")
    parser.add_argument("--settle", type=float, default=8.0)
    parser.add_argument("--width", type=int, default=640)
    parser.add_argument("--height", type=int, default=720)
    parser.add_argument("--browser", default="chrome")
    parser.add_argument("--headless", action="store_true")
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
            "stages": [name for name, _ in entry_stages],
        }, indent=2), encoding="utf-8")
        writer = FrameWriter(out_dir)
        router = CrawlRouter(writer)

        async with async_playwright() as playwright:
            context = await playwright.chromium.launch_persistent_context(
                user_data_dir=str(profile),
                channel=args.browser if args.browser != "chromium" else None,
                headless=args.headless,
                viewport={"width": args.width, "height": args.height},
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

                # Router must attach BEFORE navigation — the game socket opens
                # during it, and Playwright only surfaces brand-new sockets.
                page.on("websocket", on_websocket)
                context.on("page", lambda p: p.on("websocket", on_websocket))
                page = await navigate_to_game(context, page, args.url, prepare_page=prepare)
                try:
                    await page.evaluate(WS_SEND_HOOK_JS)  # belt & suspenders for the live doc
                except Exception as exc:  # noqa: BLE001 — heartbeats retrigger the send hook
                    print(f"[hook] send-hook evaluate skipped: {exc}", flush=True)
                guard_task = asyncio.create_task(
                    install_game_core_frame_guard_after_delay(page))
                await asyncio.sleep(args.settle)

                try:
                    await run_stages(page, writer, out_dir, entry_stages)
                    summary = await run_crawl(page, router, out_dir)
                    print(f"[done] {json.dumps(summary, ensure_ascii=False)}", flush=True)
                finally:
                    guard_task.cancel()
            finally:
                await context.close()
    finally:
        release_profile_lock(profile, LOCK_FILENAME)


if __name__ == "__main__":
    asyncio.run(main())
