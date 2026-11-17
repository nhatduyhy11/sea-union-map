"""Sea cache lifecycle and one-server captured-run parity with migrated data."""

import asyncio
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

SOCKET = Path(__file__).resolve().parents[1]
REPO = SOCKET.parents[1]
sys.path.insert(0, str(SOCKET))
from sea_socket.crawl.phases import run_crawl
from sea_socket.event_cache import (
    INFO_KEYS,
    ROOT,
    info_from_run,
    load_info,
    normalize_info,
    save_info,
)


class SeaCacheTests(unittest.TestCase):
    def test_all_migrated_snapshots_have_valid_cache_and_no_embedded_info(self):
        for path in (REPO / "src/data/snapshots").glob("*/*.json"):
            dump = json.loads(path.read_text())
            self.assertFalse(set(INFO_KEYS) & dump.keys(), path)
            info = load_info(dump["eventStart"], dump["server"])
            self.assertIsNotNone(info)
            bosses = ROOT / dump["eventStart"] / dump["server"] / "bosses.json"
            self.assertTrue(json.loads(bosses.read_text()))

    def test_single_server_captured_builder_schema_matches_migration(self):
        # Raw captures are local evidence, not a prerequisite for portable CI.
        runs = []
        event = "261116"
        target_roster = load_info(event, "517")["guildRoster"]
        for meta in (REPO / ".tmp/sea-crawl").glob("*/meta.json"):
            if not all(
                (meta.parent / name).exists()
                for name in ("players.jsonl", "guild-names.json", "map-snapshot.json")
            ):
                continue
            raw = json.loads((meta.parent / "map-snapshot.json").read_text())
            roster = {
                str(pid): str(gid)
                for gid, members in raw.get("guild_roster", {}).items()
                for pid in members
            }
            if roster == target_roster:
                runs.append(meta.parent)
        if not runs:
            self.skipTest("No local server-517 capture")
        run = max(runs)
        built = info_from_run(run, event, "517")
        migrated = load_info(event, "517")
        self.assertEqual(set(built), set(migrated))
        # Migration and a later crawl share a schema and event roster, but can
        # have different brief coverage, names and power. Validate the builder
        # against its own captured source, not against migrated identity values.
        self.assertEqual(built["guildRoster"], target_roster)
        captured = {
            str(b["id"]): b
            for line in (run / "players.jsonl").read_text().splitlines()
            if (b := json.loads(line)).get("name")
        }
        self.assertEqual(set(built["briefs"]), set(captured))
        for pid, brief in built["briefs"].items():
            self.assertEqual(brief["name"], captured[pid]["name"], pid)
            for field in ("power", "server"):
                self.assertEqual(brief.get(field), captured[pid].get(field), (pid, field))
            if pid in target_roster:
                gid = target_roster[pid]
                self.assertEqual(brief["guildId"], gid, pid)
                self.assertEqual(brief.get("guild"), built["guildNames"].get(gid), pid)
        with tempfile.TemporaryDirectory() as tmp:
            save_info(built, Path(tmp))
            self.assertEqual(built, load_info(event, "517", Path(tmp)))
        # A cached run can be dumped with no players.jsonl or guild-names.json.
        from sea_socket.report import dump_run

        with tempfile.TemporaryDirectory() as tmp:
            cached_run = Path(tmp) / "run"
            cached_run.mkdir()
            for child in run.iterdir():
                if child.name not in ("meta.json", "players.jsonl", "guild-names.json"):
                    (cached_run / child.name).symlink_to(child.resolve())
            meta = json.loads((run / "meta.json").read_text())
            meta.update(server="517", event_start=event)
            (cached_run / "meta.json").write_text(json.dumps(meta))
            output = Path(tmp) / "517.json"
            dump_run(cached_run, out=output)
            dump = json.loads(output.read_text())
            self.assertFalse(set(INFO_KEYS) & dump.keys())
            self.assertEqual((dump["eventStart"], dump["server"]), (event, "517"))
        print(
            f"[parity] captured builder {run.name}: {len(built['briefs'])} briefs; migration schema matches"
        )

    def test_corrupt_identity_is_not_a_cache_hit(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            good = normalize_info("261116", "517", "test", {})
            save_info(good, root)
            path = root / "261116/517/info.json"
            good["server"] = "590"
            path.write_text(json.dumps(good))
            with self.assertRaises(ValueError):
                load_info("261116", "517", root)

    def test_first_crawl_reuses_then_supplements_only_missing_contributors(self):
        from types import SimpleNamespace

        from sea_socket.crawl import phases

        async def exercise(root):
            run = root / "run"
            run.mkdir()
            (run / "meta.json").write_text(
                json.dumps(
                    {"server": "517", "event_start": "261116", "started_at": "test"}
                )
            )
            snapshot = {
                "nodes": [{"id": 1}],
                "guild_roster": {"100": [1, 2]},
                "owner_counts": {1: 1},
            }

            async def guilds(*args):
                (run / "guild-names.json").write_text(
                    json.dumps({"100": {"name": "Guild", "power": 10}})
                )

            async def players(*args):
                wanted = args[-1]
                self.assertIn(wanted, ({"1", "2"}, {"2", "4"}, {"4"}))
                if wanted == {"2", "4"}:
                    # One success and one refused brief; roster identity must win.
                    router.briefs["2"] = {
                        "id": 2, "name": "Two", "guild_id": 999, "guild_name": "Other"
                    }
                (run / "players.jsonl").write_text(
                    json.dumps({"id": 1, "name": "One", "guild_id": 100}) + "\n"
                )

            (run / "map-snapshot.json").write_text(json.dumps(snapshot))
            router = SimpleNamespace(briefs={}, node_states={})
            with (
                patch.object(phases, "wait_snapshot", AsyncMock(return_value=snapshot)),
                patch.object(phases, "crawl_nodes", AsyncMock(return_value={})),
                patch.object(phases, "fetch_global_boards", AsyncMock()),
                patch.object(
                    phases, "fetch_faction_details", AsyncMock(return_value={})
                ),
                patch.object(phases, "decode_all_boards", AsyncMock(return_value={})) as decode_mock,
                patch.object(
                    phases, "fetch_guild_names", AsyncMock(side_effect=guilds)
                ) as guild_mock,
                patch.object(
                    phases, "fetch_players", AsyncMock(side_effect=players)
                ) as player_mock,
                patch("sea_socket.report.write_node_bosses"),
            ):
                await run_crawl(
                    None,
                    router,
                    run,
                    server="517",
                    event_start="261116",
                    cache_root=root,
                )
                first = load_info("261116", "517", root)
                self.assertNotIn("2", first["briefs"])
                await run_crawl(
                    None,
                    router,
                    run,
                    server="517",
                    event_start="261116",
                    cache_root=root,
                )
                self.assertEqual(first, load_info("261116", "517", root))
                self.assertEqual(guild_mock.await_count, 1)
                self.assertEqual(player_mock.await_count, 1)
                decode_mock.return_value = {
                    (118, 1): {"id_type": 1, "rows": [
                        {"player_id": "1", "score": 30},  # already cached
                        {"player_id": "2", "score": 20},
                        {"player_id": "3", "score": 0},  # no contribution
                        {"player_id": "4", "score": 10},  # refused
                    ], "self": {"player_id": "2", "score": 20}},
                    (117, 0): {"rows": [{"id_type": 1, "player_id": "2", "score": 20}]},
                    (116, 0): {"id_type": 5, "rows": [
                        {"player_id": "5", "score": 100}
                    ], "self": {"player_id": "6", "score": 100}},
                }
                await run_crawl(None, router, run, server="517", event_start="261116",
                                cache_root=root)
                updated = load_info("261116", "517", root)
                self.assertEqual(set(updated["briefs"]), {"1", "2"})
                self.assertEqual(updated["briefs"]["2"], {
                    "name": "Two", "guildId": "100", "guild": "Guild"
                })
                self.assertEqual(updated["briefs"]["1"], first["briefs"]["1"])
                for key in ("guildRoster", "guildNames", "guildPower", "sourceAt"):
                    self.assertEqual(updated[key], first[key])
                self.assertEqual(guild_mock.await_count, 1)
                self.assertEqual(player_mock.await_count, 2)
                await run_crawl(None, router, run, server="517", event_start="261116",
                                cache_root=root)
                self.assertEqual(player_mock.call_args.args[-1], {"4"})
                self.assertEqual(updated, load_info("261116", "517", root))

        with tempfile.TemporaryDirectory() as tmp:
            asyncio.run(exercise(Path(tmp)))


if __name__ == "__main__":
    unittest.main()
