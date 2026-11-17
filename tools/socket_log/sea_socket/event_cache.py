"""Sea-only identity cache, immutable during an event. Shared by migration and crawl."""

import json
import os
import re
import tempfile
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3] / "src/data/event-cache"
INFO_KEYS = ("guildRoster", "guildNames", "guildPower", "briefs")


def event_start_for_day(day: str) -> str:
    """Use the same published event calendar as the FE; never reuse another round."""
    calendar = (ROOT.parent / "eventCalendar.ts").read_text(encoding="utf-8")
    block = re.search(r"EVENT_ROUNDS = \[(.*?)\]", calendar, re.DOTALL)[1]
    for start in re.findall(r'"(\d{6})"', block):
        end = (datetime.strptime(start, "%y%m%d") + timedelta(days=6)).strftime(
            "%y%m%d"
        )
        if start <= day <= end:
            return start
    raise ValueError(
        f"No Sea event in calendar for {day}; specify --event-start YYMMDD"
    )


def normalize_info(event_start: str, server: str, source_at: str, data: dict) -> dict:
    info = {
        "schemaVersion": 1,
        "eventStart": event_start,
        "server": server,
        "sourceAt": source_at,
    }
    for key in INFO_KEYS:
        info[key] = {
            str(k): v
            for k, v in sorted(data.get(key, {}).items(), key=lambda x: int(x[0]))
        }
    info["guildRoster"] = {pid: str(gid) for pid, gid in info["guildRoster"].items()}
    info["briefs"] = {
        pid: {k: v for k, v in brief.items() if v is not None}
        for pid, brief in info["briefs"].items()
    }
    for pid, brief in info["briefs"].items():
        gid = info["guildRoster"].get(pid)
        if gid:
            brief["guildId"] = gid
            # A current brief must not attach another guild's name to the event roster.
            brief.pop("guild", None)
            if gid in info["guildNames"]:
                brief["guild"] = info["guildNames"][gid]
        elif "guildId" in brief:
            brief["guildId"] = str(brief["guildId"])
    validate_info(info, event_start, server)
    return info


def validate_info(info: dict, event_start: str, server: str) -> None:
    if (
        info.get("schemaVersion") != 1
        or info.get("eventStart") != event_start
        or info.get("server") != server
    ):
        raise ValueError("Sea cache schema/identity mismatch")
    if not re.fullmatch(r"\d{6}", event_start) or not re.fullmatch(r"\d+", server):
        raise ValueError("Invalid event/server cache key")
    if not isinstance(info.get("sourceAt"), str):
        raise TypeError("Missing cache sourceAt")
    for key in INFO_KEYS:
        if not isinstance(info.get(key), dict) or any(
            not re.fullmatch(r"\d+", k) for k in info[key]
        ):
            raise ValueError(f"Invalid {key} map")
    for pid, gid in info["guildRoster"].items():
        if not isinstance(gid, str) or not gid.isdigit():
            raise ValueError(f"Invalid guild for {pid}")
    for gid, name in info["guildNames"].items():
        if not isinstance(name, str) or not name:
            raise ValueError(f"Invalid guild name {gid}")
    for gid, power in info["guildPower"].items():
        if not isinstance(power, (int, float)) or isinstance(power, bool) or power < 0:
            raise ValueError(f"Invalid guild power {gid}")
    for pid, brief in info["briefs"].items():
        if not isinstance(brief, dict) or not isinstance(brief.get("name"), str):
            raise TypeError(f"Invalid brief {pid}")
        if (
            pid in info["guildRoster"]
            and brief.get("guildId") != info["guildRoster"][pid]
        ):
            raise ValueError(f"Brief/roster mismatch {pid}")


def atomic_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=1)
            fh.write("\n")
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def load_info(event_start: str, server: str, root: Path = ROOT) -> dict | None:
    path = root / event_start / server / "info.json"
    if not path.exists():
        return None
    info = json.loads(path.read_text(encoding="utf-8"))
    validate_info(info, event_start, server)
    return info


def save_info(info: dict, root: Path = ROOT) -> None:
    validate_info(info, info["eventStart"], info["server"])
    atomic_json(root / info["eventStart"] / info["server"] / "info.json", info)


def info_from_run(crawl: Path, event_start: str, server: str) -> dict:
    snapshot = json.loads((crawl / "map-snapshot.json").read_text())
    roster = {
        str(pid): str(gid)
        for gid, members in snapshot["guild_roster"].items()
        for pid in members
    }
    guilds = json.loads((crawl / "guild-names.json").read_text())
    data = {
        "guildRoster": roster,
        "guildNames": {gid: b["name"] for gid, b in guilds.items() if b.get("name")},
        "guildPower": {
            gid: b["power"] for gid, b in guilds.items() if b.get("power") is not None
        },
        "briefs": {},
    }
    for line in (crawl / "players.jsonl").read_text().splitlines():
        b = json.loads(line)
        if not b.get("name"):
            continue
        entry = {k: b[k] for k in ("name", "power", "server") if b.get(k) is not None}
        if b.get("guild_id"):
            entry["guildId"] = str(b["guild_id"])
        if b.get("guild_name"):
            entry["guild"] = b["guild_name"]
        if b.get("guild_name") and b.get("guild_id"):
            data["guildNames"].setdefault(str(b["guild_id"]), b["guild_name"])
        data["briefs"][str(b["id"])] = entry
    meta = json.loads((crawl / "meta.json").read_text())
    return normalize_info(event_start, server, meta["started_at"], data)
