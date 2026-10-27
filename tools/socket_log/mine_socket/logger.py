"""Live mine logger: keep a game session open and log raw mine data as JSONL.

Thin mine-specific entry over the shared core/runner.py (browser session,
websocket hookup, name fetching, run modes) + the rest of mine_socket/
(protocol, sinks, routes, report). One instance per profile: a lock file
refuses a second run,
and SIGTERM/SIGHUP (closing the terminal) stops it cleanly just like Ctrl+C.
Raw streams written under .tmp/mine-events/ — a per-run run-<ts> subdir for
--snapshot one-off passes, the shared dir otherwise (aggregated into
mine-report.json + a readable tree on stdout at the end of every run, unless
--no-report):
  - mine-events.jsonl  broadcast feed (module 0x13): cmd 0x0004 login replay +
    cmd 0x0007 real-time push, filtered to type 150 (guild-mine events),
    deduplicated by event id across pushes and restarts, optional --webhook;
  - mine-state.jsonl   full map snapshot at each login (0x48/0x0002), one tile per line;
  - mine-tiles.jsonl   live tile deltas (0x48/0x0008) whenever someone enters/leaves
    a slot (--no-tiles skips);
  - player-briefs.jsonl id -> name/guild from every 0x0d/0x0020 the client receives;
  - guild-briefs.jsonl  guild id -> name (0x24/0x0036, id recovered via response seq).

With --fetch-names (default) the logger also injects 0x0d/0x001f brief requests
through the game socket for occupant ids of sectors 2-7, so the report gets a
name for every seated player without any UI clicking.

Usage:
    uv run python tools/socket_log/mine_socket/logger.py --profile .tmp/m535 --snapshot   # one state+names pass, then exit
    uv run python tools/socket_log/mine_socket/logger.py --profile .tmp/m535 --duration 300   # auto-stop after 5 min
    uv run python tools/socket_log/mine_socket/logger.py --profile .tmp/m535 --webhook http://localhost:8000/mine-alerts
"""

import asyncio
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from core.args import build_parser, resolve_run_dir  # noqa: E402
from core.runner import GameLogger, JsonlSink  # noqa: E402

from mine_socket.handlers import build_routes  # noqa: E402
from mine_socket.report import build_report, print_tree  # noqa: E402
from mine_socket.sinks import MineEventSink  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # cp1252 consoles choke on player names

DEFAULT_DIR = pathlib.Path(".tmp/mine-events")
LOCK_FILENAME = ".mine_logger.lock"


def write_report(directory: pathlib.Path) -> None:
    """Aggregate this run's JSONL streams into mine-report.json + tree on stdout."""
    try:
        report = build_report(directory)
        out_path = directory / "mine-report.json"
        out_path.write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"[report] wrote {out_path}", flush=True)
        print_tree(report)
    except Exception as exc:  # noqa: BLE001 — a broken report must not lose the run's data
        print(f"[report] generation failed: {exc}", flush=True)


async def main() -> None:
    parser = build_parser(__doc__)
    parser.add_argument("--out", type=pathlib.Path, default=None, help="default <dir>/mine-events.jsonl")
    parser.add_argument("--state", type=pathlib.Path, default=None, help="default <dir>/mine-state.jsonl")
    parser.add_argument("--tiles", type=pathlib.Path, default=None, help="default <dir>/mine-tiles.jsonl")
    parser.add_argument("--no-tiles", action="store_true", help="Skip tile-delta logging")
    parser.add_argument(
        "--no-report",
        action="store_true",
        help="Skip the mine_report.json + tree pass at the end of the run",
    )
    args = parser.parse_args()

    # One-off snapshots land in their own timestamped dir (each gets a standalone
    # report, comparable across runs); the long-running mode keeps accumulating
    # into the fixed dir, where MineEventSink dedupes events across restarts.
    resolve_run_dir(args, DEFAULT_DIR)

    out_path = args.out or args.dir / "mine-events.jsonl"
    state_path = args.state or args.dir / "mine-state.jsonl"
    tiles_path = args.tiles or args.dir / "mine-tiles.jsonl"

    event_sink = MineEventSink(out_path, args.webhook)
    state_sink = JsonlSink(state_path, "state")
    tile_sink = None if args.no_tiles else JsonlSink(tiles_path, "tile")

    logger = GameLogger(
        args,
        lock_filename=LOCK_FILENAME,
        routes_factory=lambda ctx: build_routes(
            ctx, event_sink, state_sink, tile_sink, fetch_names=not args.no_fetch_names
        ),
    )
    ctx = await logger.run()

    done = f"[logger] done — {event_sink.new_count} new events -> {out_path}"
    done += f", {state_sink.count} state tiles -> {state_path}"
    if tile_sink is not None:
        done += f", {tile_sink.count} tile deltas -> {tiles_path}"
    done += f", {ctx.brief_sink.count} briefs -> {ctx.brief_sink.out_path}"
    done += f", {ctx.guild_sink.count} guild briefs -> {ctx.guild_sink.out_path}"
    print(done)
    if not args.no_report:
        write_report(args.dir)


if __name__ == "__main__":
    asyncio.run(main())
