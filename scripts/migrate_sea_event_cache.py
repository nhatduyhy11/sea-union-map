"""One-off migration of committed Sea dumps; dry run by default, --write to apply."""

import argparse
import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "tools/socket_log"))
from sea_socket.event_cache import (
    INFO_KEYS,
    ROOT,
    atomic_json,
    load_info,
    normalize_info,
    save_info,
)


def migrate(write=False):
    rounds = re.search(
        r"EVENT_ROUNDS = \[(.*?)\]",
        (REPO / "src/data/eventCalendar.ts").read_text(),
        re.DOTALL,
    )[1]
    rounds = re.findall(r'"(\d{6})"', rounds)

    def round_of(day):
        for r in rounds:
            if (
                r
                <= day
                <= (datetime.strptime(r, "%y%m%d") + timedelta(days=6)).strftime(
                    "%y%m%d"
                )
            ):
                return r
        raise ValueError(f"No event for {day}")

    sources = []
    for p in sorted((REPO / "src/data/snapshots").glob("*/*.json")):
        sources.append((p, round_of(p.parent.name), p.stem))
    for p in sorted((REPO / "src/data").glob("sea-live*.json")):
        match = re.fullmatch(r"sea-live\.(\d{6})-\d+\.(\d+)\.json", p.name)
        if match:
            sources.append((p, round_of(match[1]), match[2]))
        elif p.name == "sea-live.json":
            # Bundled live is explicitly the LIVE_SERVER dataset.
            server = re.search(
                r'LIVE_SERVER = "(\d+)"', (REPO / "src/data/snapshots.ts").read_text()
            )[1]
            d = json.loads(p.read_text())
            matches = [
                (e, sv)
                for q, e, sv in sources
                if q.parent.parent.name == "snapshots"
                and sv == server
                and json.loads(q.read_text()) == d
            ]
            event = d.get("eventStart") or (
                matches[0][0] if len(set(matches)) == 1 else None
            )
            if not event:
                raise ValueError(
                    "Bundled dump must match a known snapshot or carry eventStart"
                )
            sources.append((p, event, server))
        else:
            raise ValueError(f"Unknown dump identity: {p}")
    dev = REPO / "public/sea-live-dev.json"
    if dev.exists():
        d = json.loads(dev.read_text())
        matches = [
            (e, sv)
            for q, e, sv in sources
            if q.parent.parent.name == "snapshots" and json.loads(q.read_text()) == d
        ]
        identity = (
            (d["eventStart"], d["server"])
            if d.get("eventStart") and d.get("server")
            else (matches[0] if len(set(matches)) == 1 else None)
        )
        if not identity:
            raise ValueError(
                "Dev dump must match a known snapshot or carry eventStart/server"
            )
        sources.append((dev, *identity))
    groups = defaultdict(list)
    for p, event, server in sources:
        groups[event, server].append((p, json.loads(p.read_text())))
    caches, updates = [], []
    conflicts = defaultdict(int)
    for (event, server), entries in sorted(groups.items()):
        entries.sort(
            key=lambda item: (
                item[0].parent.name
                if item[0].parent.parent.name == "snapshots"
                else (
                    re.search(r"\.(\d{6})-", item[0].name)[1]
                    if re.search(r"\.(\d{6})-", item[0].name)
                    else "999999"
                ),
                str(item[0]),
            )
        )
        existing = load_info(event, server)
        merged = {key: {} for key in INFO_KEYS}
        if existing:
            merged = {key: dict(existing[key]) for key in INFO_KEYS}
        for p, dump in entries:
            for key in INFO_KEYS:
                for ident, value in dump.get(key, {}).items():
                    old = merged[key].get(ident)
                    if old is None:
                        merged[key][ident] = (
                            dict(value) if isinstance(value, dict) else value
                        )
                    elif key == "briefs":
                        for field, v in value.items():
                            if field not in old:
                                old[field] = v
                            elif old[field] != v:
                                conflicts[key + "." + field] += 1
                    elif old != value:
                        conflicts[key] += 1
            clean = {k: v for k, v in dump.items() if k not in INFO_KEYS}
            clean.update(eventStart=event, server=server)
            updates.append((p, clean))
        info = normalize_info(
            event,
            server,
            existing["sourceAt"] if existing else entries[0][1]["snapshotAt"],
            merged,
        )
        boss_old = REPO / "src/data/node-bosses" / event / f"{server}.json"
        boss_new = ROOT / event / server / "bosses.json"
        boss = json.loads((boss_old if boss_old.exists() else boss_new).read_text())
        if not boss or any(
            not k.isdigit() or not isinstance(v, int) for k, v in boss.items()
        ):
            raise ValueError(f"Invalid bosses {event}/{server}")
        caches.append((info, boss, boss_old))
    # All data is validated before mutating any source.
    if write:
        for info, boss, _ in caches:
            atomic_json(
                ROOT / info["eventStart"] / info["server"] / "bosses.json", boss
            )
            save_info(info)
        for p, data in updates:
            atomic_json(p, data)
        for _, _, old in caches:
            if old.exists():
                old.unlink()
        old_root = REPO / "src/data/node-bosses"
        if old_root.exists():
            for directory in sorted(old_root.glob("*")):
                if directory.is_dir() and not any(directory.iterdir()):
                    directory.rmdir()
            if not any(old_root.iterdir()):
                old_root.rmdir()
    print(
        json.dumps(
            {
                "write": write,
                "dumps": len(updates),
                "caches": len(caches),
                "conflicts": dict(conflicts),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true")
    migrate(parser.parse_args().write)
