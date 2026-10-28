"""Game protocol layer shared by every event logger: broadcast bus + name services.

Pure bytes -> dict functions: the broadcast feed (module 0x13) and the brief
services (0x0d player, 0x24 guild) are game-wide services any event stream may
need, while event-specific layouts live in their own subfolders (mine = module
0x48 in mine_socket/protocol.py, sea = module 0x72 in sea_socket/protocol.py).
No I/O, no playwright, no asyncio — safe to unit-test against captured bytes.
"""

import struct

from core.decode import decode_proto, encode_varint, split_frame

# Broadcast bus: the server pushes every feed entry here; consumers filter by
# the type code inside the entry payload (e.g. mine entries = type 150).
BROADCAST_MODULE = 0x13
BROADCAST_PUSH_REPLAY_CMD = 0x0004  # login replay of past feed entries
BROADCAST_PUSH_LIVE_CMD = 0x0007  # real-time pushes
BROADCAST_PUSH_CMDS = (BROADCAST_PUSH_REPLAY_CMD, BROADCAST_PUSH_LIVE_CMD)

PLAYER_MODULE = 0x0D
PLAYER_BRIEF_CMD = 0x001F  # request: packed player ids
PLAYER_BRIEF_LIST_CMD = 0x0020  # response: repeated brief
GUILD_MODULE = 0x24
GUILD_BRIEF_CMD = 0x0035  # request: one guild id
GUILD_BRIEF_LIST_CMD = 0x0036  # response: f3 = guild info; guild id only via request seq
INJECT_SEQ = 0xF0  # seq byte for injected requests; server echoes it, client ignores strays


def parse_player_briefs(payload: bytes) -> list[dict]:
    """0x0d/0x0020: repeated f2 = brief {f1: id, f2: name, f4: power, f9: server,
    f11: guild {f1: guild id, f2: guild name}}."""
    briefs = []
    for field, _wire, value in decode_proto(payload):
        if field != 2 or not isinstance(value, bytes):
            continue
        sub = {f: v for f, _w, v in decode_proto(value)}
        guild = {g: gv for g, _gw, gv in decode_proto(sub[11])} if isinstance(sub.get(11), bytes) else {}
        name = sub.get(2)
        guild_name = guild.get(2)
        briefs.append(
            {
                "id": sub.get(1),
                "name": name.decode("utf-8", "replace") if isinstance(name, bytes) else None,
                "power": sub.get(4),
                "server": sub.get(9),
                "guild_id": guild.get(1) or None,
                "guild_name": guild_name.decode("utf-8", "replace") if isinstance(guild_name, bytes) else None,
            }
        )
    return briefs


def parse_guild_brief(payload: bytes) -> dict:
    """0x24/0x0036: f3 = {f2: name, f3: description, f10: member count,
    f16: tổng lực chiến guild (khớp ~97% tổng power brief member, HUNTERS 39/41)}."""
    sub = {f: v for f, _w, v in decode_proto(payload)}
    info = {f: v for f, _w, v in decode_proto(sub[3])} if isinstance(sub.get(3), bytes) else {}
    name = info.get(2)
    description = info.get(3)
    return {
        "name": name.decode("utf-8", "replace") if isinstance(name, bytes) else None,
        "members": info.get(10),
        "power": info.get(16),
        "description": description.decode("utf-8", "replace") if isinstance(description, bytes) else None,
    }


def build_brief_request(ids: list[int]) -> bytes:
    """0x0d/0x001f request frame: [len:2][module:1][cmd:2][seq:1][f1 = packed ids]."""
    packed = b"".join(encode_varint(i) for i in ids)
    body = b"\x0a" + encode_varint(len(packed)) + packed
    return struct.pack(">HBHB", 4 + len(body), PLAYER_MODULE, PLAYER_BRIEF_CMD, INJECT_SEQ) + body


def frame_is(raw: bytes, module: int, cmds: tuple[int, ...]) -> bool:
    try:
        header, _payload = split_frame("R", raw)
    except (IndexError, struct.error):
        return False
    return header["module"] == module and header["cmd"] in cmds
