"""Offline mine decoders over a capture/capture.py capture dir.

Mine-specific extractors (core/decode.py keeps only the generic frame dumpers):
  - extract_mine_state: full guild-mine state (module 0x48) — season window,
    map state, history feed;
  - extract_mine_events: guild-mine history events (broadcast type 150).

Usage:
    uv run python tools/socket_log/mine_socket/decode.py .tmp/socket-capture/<run> mine-events
    uv run python tools/socket_log/mine_socket/decode.py .tmp/socket-capture/<run> mine-state > state.json
"""

import argparse
import datetime
import json
import pathlib
import struct
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))  # standalone CLI: reach the shared modules

from core.decode import decode_proto, read_packed_varints, split_frame
from core.protocol import BROADCAST_MODULE, BROADCAST_PUSH_REPLAY_CMD
from mine_socket.protocol import (
    MAP_STATE_CMD,
    MINE_EVENT_TYPE,
    MINE_HISTORY_CMD,
    MINE_MODULE,
    SEASON_INFO_CMD,
)


def extract_mine_state(capture_dir: pathlib.Path) -> dict:
    """Dump the full guild-mine state (module 0x48) from a capture dir.

    The client requests all three at login, before any navigation:
      0x48/0x0001 -> 0x0002  full map state (summary + repeated tile f2)
      0x48/0x0013 -> 0x0014  season window + packed season tile-id list
      0x48/0x001a -> 0x001b  mine history feed: {f2: JSON string, f1: type code} —
                             type 1 = "[pos, slot_no, ts]", type 4 = "[player_id, pos, action, ts]"
    Tile entry: f1=pos (static server-table id, NOT map*1000+tile — MINE_STRUCTURE.md §1),
    f2/f3=sector (1-7) / point level (1-9), f4=0 or guild claim id,
    f7=repeated {f1: slot no, f2: win streak},
    f5=repeated slot {f1: player id, f2: slot no, f5: packed ts chain}
    where the ts chain = future debuff-expiry milestones (+3600s per tier).
    """

    def fmt_ts(value):
        if not value:
            return None
        return datetime.datetime.fromtimestamp(value, datetime.timezone.utc).isoformat()

    frames: dict[int, bytes] = {}
    for line in (capture_dir / "index.jsonl").read_text().splitlines():
        record = json.loads(line)
        if record.get("dir") != "R" or not record.get("n"):
            continue
        raw = (capture_dir / record["file"]).read_bytes()
        try:
            header, payload = split_frame("R", raw)
        except (IndexError, struct.error):
            continue
        if header["module"] != MINE_MODULE or header["status"] != 0:
            continue
        # each cmd arrives once per session; keep the largest body
        if header["cmd"] not in frames or len(payload) > len(frames[header["cmd"]]):
            frames[header["cmd"]] = payload

    state: dict = {"season": None, "map_state": None, "history": []}

    if SEASON_INFO_CMD in frames:
        info: dict = {}
        for field, _wire, value in decode_proto(frames[SEASON_INFO_CMD]):
            if field == 3 and isinstance(value, bytes):
                info["tile_ids"] = read_packed_varints(value)
            elif field == 5:
                info["start"] = fmt_ts(value)
            elif field == 4:
                info["end"] = fmt_ts(value)
            elif field in (1, 2):
                info[f"f{field}"] = value
        state["season"] = info

    if MAP_STATE_CMD in frames:
        summary = None
        tiles = []
        for field, _wire, value in decode_proto(frames[MAP_STATE_CMD]):
            if field == 3 and isinstance(value, bytes):
                sub = {f: v for f, _w, v in decode_proto(value)}
                summary = {
                    "f1_pos": sub.get(1),
                    "f2": sub.get(2),
                    "f4": sub.get(4),
                    "f5": sub.get(5),
                    "f8": sub.get(8),
                    "f9": {f: v for f, _w, v in decode_proto(sub[9])} if isinstance(sub.get(9), bytes) else sub.get(9),
                    "f6_time": fmt_ts(sub.get(6)),
                    "f7_time": fmt_ts(sub.get(7)),
                    "f10_time": fmt_ts(sub.get(10)),
                }
            elif field == 2 and isinstance(value, bytes):
                tile: dict = {"pos": None, "slots": [], "stats": {}}
                for f, _w, v in decode_proto(value):
                    if f == 1:
                        tile["pos"] = v
                    elif f in (2, 3, 4, 8, 9):
                        tile[f"f{f}"] = v
                    elif f == 6 and isinstance(v, bytes):
                        tile["f6"] = {sf: sv for sf, _sw, sv in decode_proto(v)}
                    elif f == 7 and isinstance(v, bytes):
                        sub = {sf: sv for sf, _sw, sv in decode_proto(v)}
                        tile["stats"][sub.get(1)] = sub.get(2)
                    elif f == 5 and isinstance(v, bytes):
                        slot: dict = {"slot": None, "player_id": None, "times": []}
                        for sf, _sw, sv in decode_proto(v):
                            if sf == 1:
                                slot["player_id"] = sv
                            elif sf == 2:
                                slot["slot"] = sv
                            elif sf == 3:
                                slot["f3"] = sv
                            elif sf == 5:
                                slot["times"] = [fmt_ts(x) for x in read_packed_varints(sv)] if sv else []
                        tile["slots"].append(slot)
                tile["map"], tile["tile_idx"] = divmod(tile["pos"], 1000)
                tiles.append(tile)
        state["map_state"] = {"summary": summary, "tiles": tiles}

    if MINE_HISTORY_CMD in frames:
        events = []
        for field, _wire, value in decode_proto(frames[MINE_HISTORY_CMD]):
            if field != 2 or not isinstance(value, bytes):
                continue
            # each entry = {f2: JSON string, f1: entry type (1 or 4)}
            entry_type = None
            args = None
            for sf, _sw, sv in decode_proto(value):
                if isinstance(sv, bytes):
                    try:
                        args = json.loads(sv.decode("utf-8"))
                    except (json.JSONDecodeError, UnicodeDecodeError):
                        pass
                else:
                    entry_type = sv
            if not isinstance(args, list):
                continue
            if len(args) >= 4:
                events.append(
                    {
                        "type": entry_type,
                        "player_id": args[0],
                        "pos": args[1],
                        "action": args[2],
                        "time": fmt_ts(args[3]),
                    }
                )
            elif len(args) == 3:
                events.append(
                    {"type": entry_type, "pos": args[0], "value": args[1], "time": fmt_ts(args[2])}
                )
        state["history"] = events

    return state


def extract_mine_events(capture_dir: pathlib.Path) -> list[dict]:
    """Pull guild-mine history events (broadcast type 150) from a capture dir.

    Feed arrives as server pushes of module 0x13 cmd 0x0004 right after login;
    each entry: f1=msg id, f3=unix ts, f7=type (150 = mine), f9=template args
    like '[["AEMìn"],[28000],[5047],[9001]]' → player, template, pos, action.
    """
    events = []
    for line in (capture_dir / "index.jsonl").read_text().splitlines():
        record = json.loads(line)
        if record.get("dir") != "R" or not record.get("n"):
            continue
        raw = (capture_dir / record["file"]).read_bytes()
        try:
            header, payload = split_frame("R", raw)
        except (IndexError, struct.error):
            continue
        if header["module"] != BROADCAST_MODULE or header["cmd"] != BROADCAST_PUSH_REPLAY_CMD:
            continue
        for field, wire, value in decode_proto(payload):
            if not isinstance(value, bytes):
                continue
            entry = {}
            args_text = None
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
                        entry[3], datetime.timezone.utc
                    ).isoformat(),
                    "player": args[0][0] if args and args[0] else None,
                    "pos": args[2][0] if len(args) > 2 and args[2] else None,
                    "action": args[3][0] if len(args) > 3 and args[3] else None,
                    "raw_args": args,
                }
            )
    events.sort(key=lambda e: (e["time"], e["id"] or 0))
    return events


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("capture_dir", type=pathlib.Path)
    parser.add_argument("selector", choices=("mine-events", "mine-state"))
    args = parser.parse_args()

    # player/guild names contain CJK — never die on the Windows console codepage
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    if args.selector == "mine-events":
        print(json.dumps(extract_mine_events(args.capture_dir), ensure_ascii=False, indent=2))
    else:
        print(json.dumps(extract_mine_state(args.capture_dir), ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
