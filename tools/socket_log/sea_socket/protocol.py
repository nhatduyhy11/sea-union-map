"""SEA protocol layer: module 0x72 (battle map) + leaderboard/brief requests.

SEA-specific slice of the game protocol — the game-wide pieces (broadcast
channel, player/guild briefs, frame classifier) live in core/protocol.py.
Pure bytes -> dict functions and frame builders, no I/O, no playwright,
no asyncio — safe to unit-test against captured frame bytes.
"""

import base64
import struct

from core.decode import decode_proto, encode_varint, read_packed_varints, split_frame
from core.protocol import PLAYER_BRIEF_CMD, PLAYER_MODULE

SEA_MODULE = 0x72
LOGIN_DONE_CMD = 0x0002  # response chốt boot sync — signal login-done payload entry
BATTLEFIELD_CMD = 0x000B  # request rỗng -> 0x000C snapshot (không cần ở map)
MAP_SNAPSHOT_CMD = 0x000C  # full battle-map snapshot pushed on map open
NODE_STATE_CMD = 0x0011  # request {f1: id} -> 0x0012 node state
STANDINGS_CMD = 0x001B  # request rỗng -> 0x001C bảng nhiên liệu 4 phe
FACTION_DETAIL_CMD = 0x0024  # request {f1: faction id} -> 0x0025 guild scores

RANK_MODULE = 0x0C
RANK_CMD = 0x0002
RANK_FACTION = 116
RANK_PLAYER = 117
RANK_NODE = 118


def build_request(module: int, cmd: int, seq: int, fields: list[tuple[int, int]]) -> bytes:
    """[len:2][module:1][cmd:2][seq:1] + protobuf body of varint-only fields."""
    body = b"".join(
        encode_varint((field << 3) | 0) + encode_varint(value) for field, value in fields
    )
    return struct.pack(">HBHB", 4 + len(body), module, cmd, seq) + body


def build_brief_frame(seq: int, ids: list[int]) -> bytes:
    """0x0d/0x001f with a caller-chosen ssid (core.protocol.build_brief_request
    hardcodes INJECT_SEQ, which would collide across consecutive batches)."""
    packed = b"".join(encode_varint(int(i)) for i in ids)
    body = b"\x0a" + encode_varint(len(packed)) + packed
    return struct.pack(">HBHB", 4 + len(body), PLAYER_MODULE, PLAYER_BRIEF_CMD, seq) + body


def iter_frames(direction: str, raw: bytes):
    """Yield (header, body) for every sub-frame in one WS message."""
    i = 0
    while i + 2 <= len(raw):
        (length,) = struct.unpack(">H", raw[i : i + 2])
        # length = 4 + body (S) / 7 + body (R): request rỗng dài đúng 4 — guard
        # cũ `length < 5` drop mất toàn bộ request rỗng chiều S (E6, 2026-10-29)
        if length < 4 or i + 2 + length > len(raw):
            return
        yield split_frame(direction, raw[i : i + 2 + length])
        i += 2 + length


def parse_map_snapshot(body: bytes) -> dict:
    """0x72/0x000c: f2×N {f1 id, f2 owner}, f3×4 factions (opaque),
    f4×N guild roster {f1 guild id, f2×N {f1 player id}} — mapping đầy đủ
    player→guild của mọi phe (115 guild / 3020 player, 2026-10-27); độc lập
    với brief nên cứu được player bị server từ chối brief chéo server."""
    nodes, factions_raw = [], []
    roster: dict[int, list[int]] = {}
    for field, _wire, value in decode_proto(body):
        if field == 2 and isinstance(value, bytes):
            sub = {f: v for f, _w, v in decode_proto(value)}
            nodes.append({"id": sub.get(1), "owner": sub.get(2)})
        elif field == 3 and isinstance(value, bytes):
            factions_raw.append(base64.b64encode(value).decode())
        elif field == 4 and isinstance(value, bytes):
            guild_id, members = None, []
            for f4, _w4, v4 in decode_proto(value):
                if f4 == 1:
                    guild_id = v4
                elif f4 == 2 and isinstance(v4, bytes):
                    member = {mf: mv for mf, _mw, mv in decode_proto(v4)}
                    if member.get(1):
                        members.append(member[1])
            if guild_id is not None:
                roster[guild_id] = members
    owners: dict[int, int] = {}
    for node in nodes:
        owners[node["owner"]] = owners.get(node["owner"], 0) + 1
    return {
        "nodes": nodes,
        "owner_counts": owners,
        "factions_raw": factions_raw,
        "guild_ids": sorted(roster),
        "guild_roster": roster,
    }


def parse_standings(body: bytes) -> list[dict]:
    """0x72/0x001c: repeated f2 rows per phe {f1 id, f2 Tổng Nhiên Liệu
    (fixed64 double), f3 chưa định danh (double), f4 rank, f5 packed owned
    node ids — nguồn owner compact thay việc parse 23KB}. Top-level f3 là
    phe của account (varint, không phải row). F5 khớp 1:1 owner 0x000c
    (E1 ×3 profile, 2026-10-29)."""
    rows = []
    for field, _wire, value in decode_proto(body):
        if not isinstance(value, bytes):
            continue
        row: dict = {}
        for sf, sw, sv in decode_proto(value):
            if sw == 1:
                row[f"f{sf}"] = struct.unpack("<d", struct.pack("<Q", sv))[0]
            elif sf == 5:
                row["owned"] = read_packed_varints(sv)
            else:
                row[f"f{sf}"] = sv
        rows.append(row)
    return rows


def parse_node_state(body: bytes, requested_id: int | None = None) -> dict:
    """0x72/0x0012 body, two shapes seen 2026-10-26:
    unlocked: f1: 0, f2 {f4 art, f1 id, f2×4 {f1 faction, f2 score}}
    locked:   f1: nonzero (10,000,035 on locked "1-x"/"2-x" islands — semantics
    TBD), no f2 at all. Response does not echo the id when locked, so the
    requested id is attached by the caller."""
    err = None
    for field, _wire, value in decode_proto(body):
        if field == 1:
            err = value
        elif field == 2 and isinstance(value, bytes):
            sub = {f: v for f, _w, v in decode_proto(value)}
            scores = {}
            for f2, _w2, v2 in decode_proto(value):
                if f2 == 2 and isinstance(v2, bytes):
                    s = {f: v for f, _w, v in decode_proto(v2)}
                    if 1 in s:
                        scores[s[1]] = s.get(2, 0)
            return {"id": sub.get(1), "art": sub.get(4), "faction_scores": scores}
    return {"id": requested_id, "art": None, "faction_scores": {}, "locked_err": err}


def parse_faction_detail(body: bytes) -> dict:
    """0x72/0x0025 (Tổng quan phe): f2 {f1 faction, f2×N {f1 guild, f2 score},
    f3 cityNum, f4 fightCap (fixed64 double), f5 rank}. Guild scores sum to the
    faction total from node states — verified exact on run 2026-10-27."""
    for field, _wire, value in decode_proto(body):
        if field != 2 or not isinstance(value, bytes):
            continue
        info: dict = {"faction": None, "guilds": [], "city_num": None,
                      "rank": None, "fight_cap": None}
        for f, wire, v in decode_proto(value):
            if f == 1:
                info["faction"] = v
            elif f == 2 and isinstance(v, bytes):
                row = {rf: rv for rf, _rw, rv in decode_proto(v)}
                info["guilds"].append({"guild_id": row.get(1), "score": row.get(2, 0)})
            elif f == 3:
                info["city_num"] = v
            elif f == 4 and wire == 1:
                info["fight_cap"] = struct.unpack("<d", struct.pack("<Q", v))[0]
            elif f == 5:
                info["rank"] = v
        info["guilds"].sort(key=lambda g: -g["score"])
        return info
    return {"faction": None, "guilds": [], "city_num": None, "rank": None,
            "fight_cap": None}
