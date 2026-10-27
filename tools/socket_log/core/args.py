"""Shared CLI surface for the event loggers (the args half of core.runner.GameLogger).

Each event logger starts from build_parser() and adds its own event-specific
args before parse_args(); resolve_run_dir() applies the shared --dir/--snapshot
defaulting. Attributes the core reads off the parsed namespace: profile, url,
dir, briefs, guilds, no_fetch_names, snapshot, snapshot_timeout, duration
(webhook is consumed by the event's own sink).
"""

import argparse
import datetime
import pathlib


def build_parser(description: str) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument("--profile", default=".tmp/m535")
    parser.add_argument("--url", default="https://hauntedroomvnh5.joynetgame.com/")
    parser.add_argument(
        "--dir",
        type=pathlib.Path,
        default=None,
        help="Base dir for the raw JSONL streams (each logger picks its own "
        "default; run-<ts> subdir for --snapshot one-off runs)",
    )
    parser.add_argument("--briefs", type=pathlib.Path, default=None, help="default <dir>/player-briefs.jsonl")
    parser.add_argument("--guilds", type=pathlib.Path, default=None, help="default <dir>/guild-briefs.jsonl")
    parser.add_argument(
        "--no-fetch-names",
        action="store_true",
        help="Don't inject 0x0d/0x001f brief requests for queued ids (passive only)",
    )
    parser.add_argument("--webhook", default=None, help="POST JSON for each fresh event batch")
    parser.add_argument(
        "--snapshot",
        action="store_true",
        help="Exit once the event's snapshot-done check reports complete (overrides --duration)",
    )
    parser.add_argument(
        "--snapshot-timeout",
        type=float,
        default=120.0,
        help="Hard time limit for --snapshot mode (default: 120s)",
    )
    parser.add_argument("--duration", type=float, default=None, help="Seconds to run (default: forever)")
    return parser


def resolve_run_dir(args: argparse.Namespace, default_base: pathlib.Path) -> pathlib.Path:
    """Fill args.dir from the event's default; one-off snapshots get run-<ts> subdir.

    Local wall-clock time so run-<ts> matches when the run actually started.
    """
    if args.dir is None:
        started_at = datetime.datetime.now().astimezone()
        args.dir = default_base / f"run-{started_at:%Y%m%d-%H%M%S}" if args.snapshot else default_base
    return args.dir
