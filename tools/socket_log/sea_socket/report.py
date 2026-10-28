"""Dump a sea-crawl run + CampGVG config as pure JSON for the FE.

Python chỉ nhả data thuần — KHÔNG sinh code. Mọi join (game-id → layout-id,
faction → hướng) là việc của adapter FE ``src/data/sea-live.ts``.

Mặc định dump vào ``public/sea-live-dev.json`` — gitignored, FE dev server
fetch lúc runtime (crawl xong, refresh browser là thấy). Để ship snapshot
chính thức vào bundle, chỉ đích ``--out src/data/sea-live.json``.

Nội dung dump (key → nguồn):

- ``camp``       ← ``campgvglo.json``: tên node/_type/_pointRequire, id == server id
- ``owner``      ← ``map-snapshot.json``: game faction id đang giữ từng node
- ``nodeRows``   ← ``boards-decoded.json``: [gameNodeId, playerId, score, campId]
                   (server cắt top-20/node)
- ``playerBoard`` ← ``boards-decoded.json`` (117, 0): [rank, playerId, score, campId]
                   (BXH điểm server top-200 — nguồn sự thật tab Cá nhân)
- ``factionGuilds`` ← ``guild-scores.json`` (0x72/0x0025): factionId →
                   [[guildId, điểm ST], ...] sort giảm dần (tab Phe)
- ``guildNames`` ← ``players.jsonl``: guildId → tên (từ brief member; guild
                   không có member nào được brief thì thiếu tên)
- ``guildRoster`` ← ``map-snapshot.json`` f4: playerId → guildId (mapping đầy
                   đủ 115 guild độc lập với brief — cứu player bị refuse brief)
- ``briefs``     ← ``players.jsonl``: playerId → tên + guild (+guildId, +power, +server)
- ``baseDir``    ← tên 4 đảo base → hướng trên layout (specs/map-*.PNG)
- ``snapshotAt`` ← ``map-snapshot.json``: logged_at (nếu có)

Usage:
    # Dev: dump vào public/ (gitignored), refresh browser để xem
    uv run python tools/socket_log/sea_socket/report.py \
        --crawl .tmp/sea-crawl/sea-crawl-v4 \
        --config .tmp/sea-crawl/campgvglo.json
    # Ship: bake snapshot chính thức vào bundle
    uv run python tools/socket_log/sea_socket/report.py \
        --crawl .tmp/sea-crawl/sea-crawl-v4 \
        --config .tmp/sea-crawl/campgvglo.json \
        --out src/data/sea-live.json
"""

import argparse
import json
import re
from pathlib import Path

# game faction id → map direction — read off the 4 base rows (ids 1..4) whose
# corner positions identify them on the spec screenshots.
BASE_DIR = {
    "Vịnh Thao Thiết": "east",      # right-middle edge (specs/map-right.PNG)
    "Long Khư U Ám": "south",       # bottom-center (specs/map-mid.PNG)
    "Thần Tự Lấp Lánh": "north",    # top-center (specs/map-mid.PNG)
    "Thánh Đảo Lạnh Giá": "west",   # left-middle edge (specs/map-base.PNG)
}


def load_boards_decoded(crawl: Path) -> dict:
    return json.loads((crawl / "boards-decoded.json").read_text(encoding="utf-8"))


def node_rows(boards: dict) -> list:
    rows = []
    for key, board in boards.items():
        m = re.fullmatch(r"\(118, (\d+)\)", key)
        if not m:
            continue
        node_id = int(m.group(1))
        for row in board["rows"]:
            info = row.get("addition_info")
            if isinstance(info, str):
                info = json.loads(info)
            camp = (info or {}).get("campId")
            if camp is None:
                continue
            rows.append([node_id, int(row["player_id"]), row["score"], camp])
    rows.sort()
    return rows


def layout_id_of(camp: dict) -> str | None:
    if camp["type"] == 1:
        return None
    if camp["type"] == 5:
        return "4"
    m = re.search(r"(\d+-\d+)(?!.*\d+-\d+)", camp["name"])
    return m.group(1) if m else None


def player_board(boards: dict) -> list:
    board = boards.get("(117, 0)", {})
    rows = []
    for row in board.get("rows", []):
        info = row.get("addition_info")
        camp = int(info) if isinstance(info, str) and info.isdigit() else None
        rows.append([row["rank"], int(row["player_id"]), row["score"], camp])
    rows.sort()
    return rows


def faction_guilds(crawl: Path) -> dict:
    path = crawl / "guild-scores.json"
    if not path.exists():
        return {}
    raw = json.loads(path.read_text(encoding="utf-8"))
    factions = raw.get("factions", raw)
    return {fid: [[g["guild_id"], g["score"]] for g in detail["guilds"]]
            for fid, detail in factions.items()}


def guild_brief_names(crawl: Path) -> dict:
    """guild-names.json (0x24/0x0035) — tên guild trực tiếp, không cần member
    brief; phủ cả guild mà mọi member đều bị refuse brief chéo server."""
    path = crawl / "guild-names.json"
    if not path.exists():
        return {}
    raw = json.loads(path.read_text(encoding="utf-8"))
    return {gid: brief["name"] for gid, brief in raw.items() if brief.get("name")}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--crawl", required=True, type=Path)
    parser.add_argument("--config", required=True, type=Path,
                        help="campgvglo.json từ config_extract.py")
    parser.add_argument("--out", default="public/sea-live-dev.json", type=Path)
    args = parser.parse_args()

    snapshot = json.loads(
        (args.crawl / "map-snapshot.json").read_text(encoding="utf-8"))
    owner = {n["id"]: n["owner"] for n in snapshot["nodes"]}
    boards = load_boards_decoded(args.crawl)
    briefs = {}
    guild_names = {}
    with (args.crawl / "players.jsonl").open(encoding="utf-8") as fh:
        for line in fh:
            p = json.loads(line)
            entry = {"name": p["name"]}
            if p.get("guild_id"):
                entry["guildId"] = str(p["guild_id"])
                guild_names.setdefault(str(p["guild_id"]), p.get("guild_name"))
            if p.get("guild_name"):
                entry["guild"] = p["guild_name"]
            if p.get("power") is not None:
                entry["power"] = p["power"]
            if p.get("server") is not None:
                entry["server"] = p["server"]
            briefs[p["id"]] = entry
    guild_names = {gid: name for gid, name in guild_names.items() if name}
    guild_names.update(guild_brief_names(args.crawl))
    camp_raw = json.loads(args.config.read_text(encoding="utf-8"))["CampGVGLO"]
    camp = {
        int(rid): {
            "name": row["_name"],
            "type": row["_type"],
            "pointRequire": row["_pointRequire"],
        }
        for rid, row in camp_raw.items()
        if not rid.startswith("_")
    }

    # Cross-checks that catch a stale join before it ships.
    missing_base = [n for n, d in BASE_DIR.items()
                    if n not in {c["name"] for c in camp.values()}]
    if missing_base:
        raise SystemExit(f"base names not in CampGVG: {missing_base}")
    base_dirs = {owner[game_id]: dir_ for game_id, c in camp.items()
                 if (dir_ := BASE_DIR.get(c["name"])) is not None}
    if sorted(base_dirs) != [1, 2, 3, 4]:
        raise SystemExit(f"base owners unexpected: {base_dirs}")
    unmatched = [gid for gid in owner if gid not in
                 {g for g, c in camp.items() if layout_id_of(c)} |
                 {g for g, c in camp.items() if c["type"] == 1}]
    if unmatched:
        raise SystemExit(f"snapshot nodes without layout id: {unmatched}")

    rows = node_rows(boards)
    board_rows = player_board(boards)
    guilds_by_faction = faction_guilds(args.crawl)
    roster = {str(pid): str(gid)
              for gid, members in snapshot.get("guild_roster", {}).items()
              for pid in members}
    known = {pid for _g, pid, _s, _c in rows}
    unnamed = sorted(known - set(briefs))
    payload = {
        "snapshotAt": snapshot.get("logged_at", "n/a"),
        "camp": {str(g): c for g, c in camp.items()},
        "owner": {str(g): o for g, o in owner.items()},
        "nodeRows": rows,
        "playerBoard": board_rows,
        "factionGuilds": {str(f): g for f, g in guilds_by_faction.items()},
        "guildNames": guild_names,
        "guildRoster": roster,
        "briefs": {str(p): b for p, b in briefs.items()},
        "baseDir": BASE_DIR,
    }
    args.out.write_text(
        json.dumps(payload, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8")
    print(f"[sea-to-ui] {args.out}: {len(camp)} camp rows, {len(owner)} owners, "
          f"{len(rows)} contribution rows, {len(board_rows)} playerBoard rows, "
          f"{sum(len(g) for g in guilds_by_faction.values())} guild scores, "
          f"{len(guild_names)} guild names, {len(briefs)} briefs, "
          f"{len(unnamed)} players without brief")


if __name__ == "__main__":
    main()
