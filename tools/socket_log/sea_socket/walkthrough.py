"""POC walkthrough into the Tranh Bá Tứ Hải (Sea Union) event, capturing raw WS frames.

Thin entry over the capture CLI's pieces — FrameWriter (capture/frames.py), step
DSL (gui/steps.py), launch block (browser/session.py) —
plus named STAGES for the navigation flow in docs/sea/SEA_STRUCTURE.md §2 and wheel
scroll for the event-lobby list. Expect guards cover only the home→sea-lobby
entry (login + open-sea): that stretch has no fallback if a click misses, so a
wrong screen must stop the run. Deeper screens stay inside the same lobby
context — a missed click there is harmless, shots are evidence enough.

Coordinates are initial reads off docs/assets/sea-socket/*.png (viewport 640x720
→ 1:1); methodology per docs/research/2026-10-22-socket-step-learn.md:
run stage → Read the shot → fix coords → rerun (--from <stage>).

Usage:
    uv run python tools/socket_log/sea_socket/walkthrough.py --list
    uv run python tools/socket_log/sea_socket/walkthrough.py                  # full walkthrough
    uv run python tools/socket_log/sea_socket/walkthrough.py --from open-sea  # resume mid-flow
    uv run python tools/socket_log/sea_socket/walkthrough.py --only login     # probe one stage
"""

import argparse
import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from playwright.async_api import Page, async_playwright

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from browser.page_guards import close_profile_popup_tabs
from browser.process_guard import acquire_profile_lock, release_profile_lock
from browser.session import close_session, launch_session
from capture.frames import DEFAULT_OUT_DIR, FrameWriter
from gui.steps import parse_step, run_step

DEFAULT_PROFILE = ".tmp/p545"
LOCK_FILENAME = ".sea_capture.lock"

# Boss-detail popup ("Chi tiết"): magnifier in the node-detail header is (383,251) —
# (349,251) is the swap icon next to it; red X at (476,149).
BOSS_LENS = "383,251"
BOSS_CLOSE = "476,149"
# Node leaderboard: gold coin-stack circle in the node-detail corner, X at (487,88).
BOARD_STACK = "487,479"
BOARD_CLOSE = "487,88"
# Closing the node detail is an outside click on the dark area below the
# popup (owner-confirmed; popup spans ~140-530 x 225-505). (80,620) does NOT
# work — a probe showed the popup still open after it (some
# dimmed element there eats the click); (318,560) closed it for real. On the
# plain map that point is the non-node bottom island, whose click sends no
# frame — a harmless no-op if close is ever called with nothing open.
DETAIL_CLOSE = "318,560"


def node_steps(idx: int, x: int, y: int) -> list[str]:
    """Detail + boss + leaderboard for one node, plus a post-close proof shot —
    a stuck popup once masqueraded as every later node's detail (runs 093346/
    094110: DETAIL_CLOSE was dead, so 7-n02..04 shots were all n01's popup).
    Shot prefix = figure number in docs/sea/SEA_STRUCTURE.md; chronology lives in
    index.jsonl marks, not filenames."""
    n = f"n{idx:02d}"
    return [
        f"mark:{n}-open", f"click:{x},{y}", f"shot:7-{n}-detail",
        f"mark:{n}-boss", f"click:{BOSS_LENS}", f"shot:9-{n}-boss", f"click:{BOSS_CLOSE}",
        f"mark:{n}-board", f"click:{BOARD_STACK}", f"shot:8-{n}-board", f"click:{BOARD_CLOSE}",
        f"mark:{n}-close", f"click:{DETAIL_CLOSE}", f"shot:probe-{n}-closed",
    ]


STAGES: list[tuple[str, list[str]]] = [
    ("login", [
        "mark:01-logged-in",
        # 2026-10-26 (war day 1): a queue of no-X event splash popups paints
        # over home as soon as the game loads ("Tranh Bá Tứ Hải", "Tranh Đoạt
        # U Độ", "Tranh Bá Hắc Ám", … ~2s apart). Dismissal order per splash:
        # tick the reminder checkbox first (visual template match — never
        # text search; it commits only on a proper close — runs
        # 124313/124849), optional X icon, then the outside click. The
        # outside click doubles as the canonical entry: at (424,688) it is
        # swallowed by the overlay while a splash is up, and once the queue
        # drains it opens the "Lối vào PB" event lobby directly (owner call;
        # stray clicks at other margins opened unrelated screens — run
        # 132157 landed in the Shop).
        "sleep:8",
        "shot:1-home-init",
        "mark:01-popclose", "popclose:10,0.97,3",
        "sleep:2",
        "shot:1-home-clean",
        "expect:2a-event-lobby-start,0.94",
    ]),
    ("open-sea", [
        # popclose's last outside click already entered the event list (see
        # login). Reset to the top first (run 134234: an 8x dy=3000 seek
        # landed past the target — the war-day list reordered), then hunt the
        # Tranh Bá Tứ Hải banner card with a fine-grained scroll (dy=600 per
        # round, 14 rounds) so no card slips between screenshots.
        "mark:02-open-events", "scroll:320,400,0,-3000,15",
        "shot:2a-event-lobby-top",
        "mark:02-scroll-end",
        "seek:2b-event-lobby-scroll-end,170,492,310,122,230,102,320,400,600,14",
        "shot:2b-event-lobby-scroll-end",
        # The lobby plays a vibrant 4-character intro art before idling down to
        # the state the 3-sea-home golden shows (run 095111: shot at t+2s
        # scored 0.898 against it — right screen, wrong animation frame).
        "sleep:5",
        # A promo splash popped right after entering the lobby via the
        # go-live splash's Đến (run 125545) — eat any late queue item first.
        "mark:02-lobby-popclose", "popclose:2",
        "shot:3-sea-home", "expect:3-sea-home",  # MANDATORY proof
    ]),
    ("leaderboards", [
        "mark:04-open-bxh", "click:494,133", "shot:4-leaderboard-faction",
        "mark:04-tab-score", "click:264,689", "shot:4-leaderboard-player",
        "mark:04-back", "click:488,690",
    ]),
    ("factions", [
        # Enter via the first lobby flag, then switch factions with the in-page
        # flag tabs (docs/sea/SEA_STRUCTURE.md §3.4) instead of 4 lobby round-trips.
        "mark:05-flag-1", "click:145,612", "shot:5-faction-1",
        "mark:05-tab-2", "click:232,686", "shot:5-faction-2",
        "mark:05-tab-3", "click:300,684", "shot:5-faction-3",
        "mark:05-tab-4", "click:377,688", "shot:5-faction-4",
        "mark:05-back", "click:488,690",
    ]),
    ("battle-map", [
        "mark:06-open-map", "click:320,295", "shot:6-battle-map",
    ]),
    ("nodes", [
        # Four regular nodes visible in 6-battle-map.png; coords target the
        # island icons, not their "Chưa mở khóa" labels. NOT clickable nodes:
        # the central temple (310,225) — its click never opened a node detail
        # (later clicks surfaced the strategic "Chi tiết /
        # Hiệu suất của phe ta" popup instead) — and the bottom island
        # (318,570): clicking it sends no WS frame at all, likely the south
        # faction base (PROJECT_INTENT §4.1). The old "every node shows
        # 1-23Đảo Câu Cá" observation was a stuck-popup artifact (see
        # DETAIL_CLOSE) — with close fixed, whether details differ per node
        # gets read from this run's shots + frames.
        *node_steps(1, 232, 322),
        *node_steps(2, 404, 322),
        *node_steps(3, 318, 388),
        *node_steps(4, 318, 468),
    ]),
    ("map-pan", [
        # Coords for a nodes-2 stage get added after reading these shots.
        # Wheel on the canvas ZOOMS rather than pans (2026-10-24: one dx=600
        # wheel pulled the view out, revealing ~15 more nodes) — these shots
        # are the coordinate source for a wider node sweep. No expect: zoomed
        # views have no golden (probe stage, shots are evidence).
        "mark:06-zoom-out", "scroll:320,400,600,0", "shot:6-map-pan-1",
        "mark:06-zoom-more", "scroll:320,400,600,0", "shot:6-map-pan-2",
    ]),
    ("nodes-2", [
        # Every island position visible in the zoomed view (6-map-pan-1, which
        # a probe showed == 6-map-pan-2 — the second wheel clamps, so
        # this stage always runs in exactly that view). The zoomed icons are
        # ~40px; coords target their centers. Whether each opens a detail, and
        # whether the details differ from the default-view nodes, gets read
        # from the shots + the WS frames after the run.
        *node_steps(11, 263, 215),
        *node_steps(12, 370, 215),
        *node_steps(13, 173, 268),
        *node_steps(14, 310, 268),
        *node_steps(15, 462, 268),
        *node_steps(16, 310, 322),
        *node_steps(17, 310, 398),
        *node_steps(18, 262, 470),
        *node_steps(19, 377, 470),
        *node_steps(20, 262, 562),
        *node_steps(21, 372, 562),
        *node_steps(22, 472, 585),
        *node_steps(23, 365, 635),
    ]),
]


async def run_stages(page: Page, writer: FrameWriter, out_dir: Path,
                     stages: list[tuple[str, list[str]]]) -> None:
    for name, steps in stages:
        await writer.mark(f"stage:{name}")
        print(f"[stage] {name} ({len(steps)} steps)")
        spec = "<none>"
        try:
            for spec in steps:
                await close_profile_popup_tabs(page, f"sea:{name}")
                verb, arg = parse_step(spec)
                await run_step(page, writer, verb, arg, out_dir)
        except Exception as exc:
            # Fail fast: a missed click does not raise, it just desyncs every
            # later step, so continuing only produces garbage captures.
            fail = out_dir / "screens" / f"FAIL-{name}.png"
            await page.screenshot(path=str(fail))
            raise RuntimeError(f"stage '{name}' failed on '{spec}'; evidence: {fail}") from exc
        await writer.mark(f"stage:{name}:end")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--profile", default=DEFAULT_PROFILE)
    parser.add_argument("--url", default="https://hauntedroomvnh5.joynetgame.com/")
    parser.add_argument("--out", default=None, help="Output dir (default .tmp/socket-capture/sea-<ts>)")
    parser.add_argument("--settle", type=float, default=8.0, help="Seconds to wait after navigation")
    parser.add_argument("--headless", action="store_true")
    parser.add_argument("--width", type=int, default=640)
    parser.add_argument("--height", type=int, default=720)
    parser.add_argument("--browser", default="chrome")
    parser.add_argument("--list", action="store_true", help="Print stage names and exit")
    parser.add_argument("--from", dest="from_stage", help="Run stages from this name to the end")
    parser.add_argument("--only", help="Run a single stage (game must already be on its entry screen)")
    parser.add_argument("--step", action="append", default=[], help="Extra DSL steps after the stages")
    return parser


def select_stages(args: argparse.Namespace) -> list[tuple[str, list[str]]]:
    names = [name for name, _ in STAGES]
    if args.only and args.from_stage:
        raise SystemExit("--from and --only are mutually exclusive")
    if args.only:
        if args.only not in names:
            raise SystemExit(f"unknown stage: {args.only} (have: {', '.join(names)})")
        return [next(stage for stage in STAGES if stage[0] == args.only)]
    if args.from_stage:
        if args.from_stage not in names:
            raise SystemExit(f"unknown stage: {args.from_stage} (have: {', '.join(names)})")
        return STAGES[names.index(args.from_stage):]
    return list(STAGES)


async def main() -> None:
    args = build_parser().parse_args()
    if args.list:
        for name, steps in STAGES:
            print(f"{name}: {len(steps)} steps")
        return
    stages = select_stages(args)

    started_at = datetime.now().astimezone()
    out_dir = Path(args.out) if args.out else DEFAULT_OUT_DIR / f"sea-{started_at:%Y%m%d-%H%M%S}"
    out_dir.mkdir(parents=True, exist_ok=True)
    profile = Path(args.profile)
    if not acquire_profile_lock(profile, LOCK_FILENAME):
        print(f"[lock] {profile} is busy ({LOCK_FILENAME} held) — refusing to run")
        return
    try:
        (out_dir / "meta.json").write_text(
            json.dumps(
                {
                    "url": args.url,
                    "profile": args.profile,
                    "started_at": started_at.isoformat(),
                    "from": args.from_stage,
                    "only": args.only,
                    "stages": [name for name, _ in stages],
                    "steps": [step for _, steps in stages for step in steps],
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        writer = FrameWriter(out_dir)
        async with async_playwright() as playwright:
            session = await launch_session(
                playwright,
                profile=args.profile,
                url=args.url,
                writer=writer,
                settle=args.settle,
                width=args.width,
                height=args.height,
                browser=args.browser,
                headless=args.headless,
            )
            try:
                await run_stages(session.page, writer, out_dir, stages)
                for spec in args.step:
                    verb, arg = parse_step(spec)
                    await run_step(session.page, writer, verb, arg, out_dir)
                if writer.seq:
                    print(f"[done] captured {writer.seq} frames -> {out_dir}")
            finally:
                await close_session(session)
    finally:
        release_profile_lock(profile, LOCK_FILENAME)


if __name__ == "__main__":
    asyncio.run(main())
