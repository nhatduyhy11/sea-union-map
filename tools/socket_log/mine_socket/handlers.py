"""Mine-specific websocket wiring: frame routing + snapshot completion.

build_routes() plugs the mine streams into the shared GameLogger core
(core/runner.py): broadcast type-150 events, 0x48 map state / tile deltas,
plus the --snapshot done-predicate (one state captured, all occupant names
settled).
"""

import asyncio
from typing import Optional

from core.protocol import BROADCAST_MODULE, BROADCAST_PUSH_CMDS, frame_is
from core.decode import split_frame
from core.runner import FrameRoutes, JsonlSink, LoggerContext

from mine_socket.protocol import (
    MINE_MODULE,
    MAP_STATE_CMD,
    TILE_DELTA_CMD,
    parse_mine_event,
    parse_tiles,
)

SECTOR_MIN, SECTOR_MAX = 2, 7  # sector 1 is the flat 124-slot tile — out of scope


def occupant_ids(tiles: list[dict]) -> set[int]:
    """Player ids seated in the tracked sectors (fed to the core's NameFetcher)."""
    return {
        player_id
        for tile in tiles
        if tile["sector"] is None or SECTOR_MIN <= tile["sector"] <= SECTOR_MAX
        for player_id in tile["occupied"].values()
    }


def build_routes(
    ctx: LoggerContext,
    event_sink,
    state_sink: JsonlSink,
    tile_sink: Optional[JsonlSink],
    *,
    fetch_names: bool = True,
) -> FrameRoutes:
    """Route mine frames into the sinks; carry the snapshot-done predicate."""

    def on_frame(payload: bytes) -> None:
        if frame_is(payload, BROADCAST_MODULE, BROADCAST_PUSH_CMDS):
            _header, body = split_frame("R", payload)
            asyncio.ensure_future(event_sink.add(parse_mine_event(body)))
        elif frame_is(payload, MINE_MODULE, (MAP_STATE_CMD,)):
            _header, body = split_frame("R", payload)
            tiles = parse_tiles(body)
            asyncio.ensure_future(state_sink.add(tiles))
            ctx.name_fetcher.queue(occupant_ids(tiles))
            asyncio.ensure_future(ctx.name_fetcher.flush(force=True))
        elif tile_sink is not None and frame_is(payload, MINE_MODULE, (TILE_DELTA_CMD,)):
            _header, body = split_frame("R", payload)
            tiles = parse_tiles(body)
            asyncio.ensure_future(tile_sink.add(tiles))
            ctx.name_fetcher.queue(occupant_ids(tiles))
            asyncio.ensure_future(ctx.name_fetcher.flush())

    last_retry = 0.0

    async def snapshot_done() -> bool:
        """True once one map state landed and every queued name fetch settled."""
        nonlocal last_retry
        loop = asyncio.get_running_loop()
        if state_sink.count == 0:
            return False  # map state not pushed yet
        if not fetch_names:
            return True  # state is all we wanted
        if ctx.name_fetcher.pending:
            if ctx.name_fetcher.page_closed:
                print("[logger] game page gone — remaining names unfetchable; exiting with partial data", flush=True)
                return True
            now = loop.time()
            if now - last_retry > 3.0:
                last_retry = now
                await ctx.name_fetcher.flush(force=True)
            return False
        return ctx.name_fetcher.settled()

    return FrameRoutes(on_frame=on_frame, snapshot_done=snapshot_done)
