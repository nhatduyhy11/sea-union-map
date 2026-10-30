r"""Interactive walkthrough capture: drive the game page with the step DSL while
dumping every WebSocket frame verbatim (binary included).

Launches the persistent-profile browser, hooks every WebSocket on every page,
and writes frames + index.jsonl so a protocol can be reverse engineered from a
single session. Started as the POC that decoded the mine-history flow; the
pieces now live in their own modules and also back the per-event walkthroughs
(sea_socket/walkthrough.py) and crawlers:
    capture/frames.py   FrameWriter + attach_capture (the actual capture)
    browser/session.py  launch_session / close_session
    gui/                vision-action: step DSL, golden matching, popclose

Usage:
    uv run python tools/socket_log/capture/capture.py --profile .tmp/p545 \
        --step sleep:8 --step shot:01_loaded --step click:463,218 ...
"""

import argparse
import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path

from playwright.async_api import async_playwright

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from browser.session import close_session, launch_session
from capture.frames import DEFAULT_OUT_DIR, FrameWriter
from gui import steps


async def main() -> None:
    parser = argparse.ArgumentParser(
        description=f"{__doc__}\n{steps.__doc__}",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--profile", default=".tmp/p545")
    parser.add_argument("--url", default="https://hauntedroomvnh5.joynetgame.com/")
    parser.add_argument("--out", default=None, help="Output dir (default .tmp/socket-capture/run-<ts>)")
    parser.add_argument("--settle", type=float, default=6.0, help="Seconds to wait after navigation")
    parser.add_argument("--headless", action="store_true")
    parser.add_argument("--width", type=int, default=640)
    parser.add_argument("--height", type=int, default=720)
    parser.add_argument("--browser", default="chrome")
    parser.add_argument("--step", action="append", default=[], help="Step DSL, repeatable")
    args = parser.parse_args()

    # Local wall-clock time so run-<ts> matches when the run actually started.
    started_at = datetime.now().astimezone()
    out_dir = Path(args.out) if args.out else DEFAULT_OUT_DIR / f"run-{started_at:%Y%m%d-%H%M%S}"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "meta.json").write_text(
        json.dumps(
            {
                "url": args.url,
                "profile": args.profile,
                "started_at": started_at.isoformat(),
                "steps": args.step,
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
            for spec in args.step:
                verb, arg = steps.parse_step(spec)
                await steps.run_step(session.page, writer, verb, arg, out_dir)
            if writer.seq:
                print(f"[done] captured {writer.seq} frames -> {out_dir}")
        finally:
            await close_session(session)


if __name__ == "__main__":
    asyncio.run(main())
