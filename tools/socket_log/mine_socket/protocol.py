"""Mine protocol layer: module 0x48 layout + broadcast type-150 events.

Mine-specific slice of the game protocol — the game-wide pieces (broadcast
channel, player/guild briefs, frame classifier) live in the top-level
game_protocol.py. Pure bytes -> dict functions, no I/O, no playwright,
no asyncio — safe to unit-test against captured frame bytes.
"""

import datetime
import json
from typing import Optional

from socket_decode import decode_proto

MINE_EVENT_TYPE = 150  # broadcast feed type code for guild-mine entries
MINE_MODULE = 0x48
MAP_STATE_CMD = 0x0002  # full snapshot at login
TILE_DELTA_CMD = 0x0008  # live single-tile pushes
SEASON_INFO_CMD = 0x0014  # season window + packed season tile-id list
MINE_HISTORY_CMD = 0x001B  # mine history feed ({f2: JSON string, f1: type code})


def parse_mine_event(payload: bytes) -> list[dict]:
    """Extract type-150 entries from one broadcast push frame."""
    events = []
    for _field, _wire, value in decode_proto(payload):
        if not isinstance(value, bytes):
            continue
        entry: dict[int, object] = {}
        args_text: Optional[str] = None
        for f2, _w2, v2 in decode_proto(value):
            if isinstance(v2, bytes):
                args_text = v2.decode("utf-8", "replace")
            else:
                entry[f2] = v2
        if entry.get(7) != MINE_EVENT_TYPE:
            continue
        try:
            args = json.loads(args_text or "[]")
        except json.JSONDecodeError:
            args = [args_text]
        events.append(
            {
                "id": entry.get(1),
                "time": datetime.datetime.fromtimestamp(
                    entry.get(3, 0), datetime.timezone.utc
                ).isoformat(),
                "player": args[0][0] if args and args[0] else None,
                "pos": args[2][0] if len(args) > 2 and args[2] else None,
                "action": args[3][0] if len(args) > 3 and args[3] else None,
                "logged_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            }
        )
    return events


def parse_tile(value: bytes) -> dict:
    """One tile — login state (0x48/0x0002) and delta (0x48/0x0008) share the layout.

    f1=pos (static server table id), f2=sector 1-7, f3=point level 1-9,
    f4=claiming guild id (5XX00YY) or 0, f5=slot {f1: player id, f2: slot no} —
    player id 0 means the slot is free.
    """
    tile: dict = {
        "pos": None,
        "sector": None,
        "level": None,
        "claim": None,
        "occupied": {},
        "free": [],
    }
    for f, _wire, v in decode_proto(value):
        if f == 1 and not isinstance(v, bytes):
            tile["pos"] = v
        elif f == 2 and not isinstance(v, bytes):
            tile["sector"] = v
        elif f == 3 and not isinstance(v, bytes):
            tile["level"] = v
        elif f == 4 and not isinstance(v, bytes):
            tile["claim"] = v or None
        elif f == 5 and isinstance(v, bytes):
            slot = {sf: sv for sf, _sw, sv in decode_proto(v)}
            player_id = slot.get(1) or 0
            slot_no = slot.get(2)
            if player_id and slot_no is not None:
                tile["occupied"][str(slot_no)] = player_id
            elif slot_no is not None:
                tile["free"].append(slot_no)
    return tile


def parse_tiles(payload: bytes) -> list[dict]:
    """Repeated f2 = tile snapshots (works for both map state and tile deltas)."""
    return [parse_tile(v) for f, _wire, v in decode_proto(payload) if f == 2 and isinstance(v, bytes)]
