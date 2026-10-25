"""POC: capture Haunted Room WebSocket frames while walking the mine-history flow.

Launches the same persistent-profile browser as ``hauntedroom_runner.py``, hooks
every WebSocket on every page, and dumps each frame verbatim (binary included)
so the mine-history protocol can be reverse engineered from a single session.

Usage:
    uv run python tools/socket_log/socket_capture.py --profile .tmp/m535 \
        --step sleep:8 --step shot:01_loaded --step click:463,218 ...

Step DSL:
    sleep:S      wait S seconds (float ok)
    shot:NAME    save out_dir/screens/NAME.png
    click:X,Y    left-click at page coordinates
    scroll:X,Y,DX,DY[,N]  move the mouse to (X,Y), wheel by (DX,DY) N times
                 (default 1, 120ms apart) — DY>0 scrolls down; the game lists
                 move only ~17-35px per event regardless of DY magnitude, so
                 reaching a list end takes many events, not a big DY
    expect:GOLDEN[,MIN]  verify the current screen resembles the golden GOLDEN
                 (grayscale 32x36 thumbnail, fail below MIN, default 0.95):
                 saves FAIL-expect-<golden>.png and raises on mismatch, so a
                 missed click stops the run instead of desyncing later steps.
                 Golden lookup: tools/socket_log/goldens/<GOLDEN>.png, then
                 docs/assets/sea-socket/<GOLDEN>.png
    seek:GOLDEN,CX,CY,CW,CH,OX,OY,X,Y,DY,N[,MIN]
                 scroll until a target is on screen, then click it: match the
                 CWxCH crop at CX,CY of golden GOLDEN against the live screen
                 (slide vertically, coarse x); up to N rounds, each 10 rapid
                 wheel events of DY at X,Y 120ms apart (the game lists only
                 accumulate scroll with rapid cadence — slow single events
                 barely move) — for lists whose content drifts as events
                 rotate, where no fixed scroll count is right. Clicks OX,OY
                 inside the matched crop; FAIL-seek-<golden>.png + raise when
                 not found.
    mark:LABEL   write a marker line into index.jsonl (correlate frames later)
"""

import argparse
import asyncio
import io
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import NamedTuple, Optional, Union

from PIL import Image
from playwright.async_api import BrowserContext, Page, Playwright, async_playwright

sys.path.insert(0, str(Path(__file__).parent))

from navigation import navigate_to_game  # noqa: E402
from page_guards import (  # noqa: E402
    install_game_core_frame_guard_after_delay,
    install_profile_popup_guard,
)

DEFAULT_OUT_DIR = Path(".tmp/socket-capture")


class FrameWriter:
    """Persist every WebSocket payload plus an index for later correlation."""

    def __init__(self, out_dir: Path) -> None:
        self.out_dir = out_dir
        self.frames_dir = out_dir / "frames"
        self.frames_dir.mkdir(parents=True, exist_ok=True)
        self.index_path = out_dir / "index.jsonl"
        self.seq = 0
        self.started = time.monotonic()
        self._lock = asyncio.Lock()

    async def _append(self, record: dict) -> None:
        line = json.dumps(record, ensure_ascii=False)
        async with self._lock:
            with self.index_path.open("a", encoding="utf-8") as fh:
                fh.write(line + "\n")

    def elapsed_ms(self) -> int:
        return int((time.monotonic() - self.started) * 1000)

    async def mark(self, label: str) -> None:
        await self._append(
            {"n": None, "t": self.elapsed_ms(), "dir": "M", "label": label}
        )
        print(f"[mark] {label} @ {self.elapsed_ms()}ms")

    async def write_frame(self, direction: str, ws_url: str, payload: Union[str, bytes]) -> None:
        self.seq += 1
        seq = self.seq
        if isinstance(payload, str):
            raw = payload.encode("utf-8")
            suffix = ".txt"
        else:
            raw = payload
            suffix = ".bin"
        name = f"{seq:05d}-{direction}{suffix}"
        (self.frames_dir / name).write_bytes(raw)
        await self._append(
            {
                "n": seq,
                "t": self.elapsed_ms(),
                "dir": direction,
                "ws": ws_url,
                "size": len(raw),
                "file": f"frames/{name}",
            }
        )
        preview = raw[:48].hex() if suffix == ".bin" else raw[:48].decode("utf-8", "replace")
        print(f"[ws {direction}] #{seq} {len(raw)}B {preview}")


def attach_capture(page: Page, writer: FrameWriter) -> None:
    def on_websocket(ws) -> None:
        print(f"[ws open] {ws.url}")
        asyncio.ensure_future(
            writer._append({"n": None, "t": writer.elapsed_ms(), "dir": "O", "ws": ws.url})
        )
        ws.on("framesent", lambda payload: asyncio.ensure_future(writer.write_frame("S", ws.url, payload)))
        ws.on(
            "framereceived",
            lambda payload: asyncio.ensure_future(writer.write_frame("R", ws.url, payload)),
        )

    page.on("websocket", on_websocket)


def parse_step(spec: str) -> tuple[str, str]:
    verb, _, arg = spec.partition(":")
    return verb.strip().lower(), arg


GOLDENS_DIR = Path(__file__).resolve().parent / "goldens"
DOCS_SEA_ASSETS = Path(__file__).resolve().parents[2] / "docs" / "assets" / "sea-socket"


def resolve_golden(name: str) -> Path:
    for base in (GOLDENS_DIR, DOCS_SEA_ASSETS):
        golden = base / f"{name}.png"
        if golden.exists():
            return golden
    raise ValueError(f"golden not found: {name} (tried {GOLDENS_DIR} and {DOCS_SEA_ASSETS})")


async def screen_similarity(page, golden: Path) -> float:
    """1 - mean |gray(a) - gray(b)| on 32x36 thumbnails: ~0.99 for the same
    screen (counters/animation differ), <=0.93 across screens (calibrated on
    the 2026-10-24 sea shots)."""
    shot = await page.screenshot()
    a = Image.open(io.BytesIO(shot)).convert("L").resize((32, 36)).tobytes()
    b = Image.open(golden).convert("L").resize((32, 36)).tobytes()
    return 1 - sum(abs(x - y) for x, y in zip(a, b)) / (len(a) * 255)


def best_crop_position(live: Image.Image, template: Image.Image,
                       x_step: int = 24, y_step: int = 6) -> tuple[float, int, int]:
    """Slide the template over the live screenshot, return (score, x, y) of the
    best window in live pixels. x scans coarse — event cards sit in a fixed
    column, only the vertical position really varies. Thresholds (calibrated
    on the 2026-10-24 sea lobby): target-in-view ~0.96, absent <=0.88."""
    cw, ch = template.size
    tw = 62
    th = max(8, round(ch * tw / cw))
    t = template.convert("L").resize((tw, th)).tobytes()
    best = (0.0, 0, 0)
    w_size, h_size = live.size
    for y in range(0, h_size - ch, y_step):
        for x in range(0, w_size - cw, x_step):
            w = live.crop((x, y, x + cw, y + ch)).convert("L").resize((tw, th)).tobytes()
            s = 1 - sum(abs(a - b) for a, b in zip(t, w)) / (len(t) * 255)
            if s > best[0]:
                best = (s, x, y)
    return best


async def run_step(page, writer: FrameWriter, verb: str, arg: str, out_dir: Path) -> None:
    if verb == "sleep":
        await asyncio.sleep(float(arg))
    elif verb == "shot":
        path = out_dir / "screens" / f"{arg}.png"
        path.parent.mkdir(parents=True, exist_ok=True)
        await page.screenshot(path=str(path))
        print(f"[shot] {path}")
    elif verb == "click":
        x_s, _, y_s = arg.partition(",")
        await page.mouse.click(int(x_s), int(y_s))
        print(f"[click] ({x_s},{y_s})")
        await asyncio.sleep(1.0)
    elif verb == "scroll":
        parts = [p.strip() for p in arg.split(",")]
        x_s, y_s, dx_s, dy_s = parts[:4]
        n = int(parts[4]) if len(parts) > 4 else 1
        await page.mouse.move(int(x_s), int(y_s))
        for _ in range(n):
            await page.mouse.wheel(int(dx_s), int(dy_s))
            await asyncio.sleep(0.12)
        print(f"[scroll] ({x_s},{y_s}) dx={dx_s} dy={dy_s} x{n}")
        await asyncio.sleep(1.0)
    elif verb == "expect":
        name, _, min_s = arg.partition(",")
        minimum = float(min_s) if min_s else 0.95
        golden = resolve_golden(name)
        score = await screen_similarity(page, golden)
        if score < minimum:
            fail = out_dir / "screens" / f"FAIL-expect-{name.replace('/', '-')}.png"
            fail.parent.mkdir(parents=True, exist_ok=True)
            await page.screenshot(path=str(fail))
            raise RuntimeError(
                f"unexpected screen: {score:.3f} < {minimum} vs {golden.name}; evidence: {fail}"
            )
        print(f"[expect] {name} {score:.3f} >= {minimum}")
    elif verb == "seek":
        parts = [p.strip() for p in arg.split(",")]
        if len(parts) not in (11, 12):
            raise ValueError(f"seek expects GOLDEN,CX,CY,CW,CH,OX,OY,X,Y,DY,N[,MIN] — got: {arg}")
        name = parts[0]
        cx, cy, cw, ch, ox, oy, x, y, dy, n = (int(p) for p in parts[1:11])
        minimum = float(parts[11]) if len(parts) == 12 else 0.92
        template = Image.open(resolve_golden(name)).crop((cx, cy, cx + cw, cy + ch))
        for attempt in range(n + 1):
            live = Image.open(io.BytesIO(await page.screenshot()))
            score, bx, by = best_crop_position(live, template)
            if score >= minimum:
                await page.mouse.click(bx + ox, by + oy)
                print(f"[seek] {name} {score:.3f} at ({bx},{by}) -> click ({bx + ox},{by + oy})")
                await asyncio.sleep(1.0)
                break
            if attempt == n:
                fail = out_dir / "screens" / f"FAIL-seek-{name.replace('/', '-')}.png"
                fail.parent.mkdir(parents=True, exist_ok=True)
                await page.screenshot(path=str(fail))
                raise RuntimeError(
                    f"seek: '{name}' not found after {n} scrolls "
                    f"(best {score:.3f} < {minimum}); evidence: {fail}"
                )
            print(f"[seek] {name}: best {score:.3f} < {minimum}, scroll {attempt + 1}/{n}")
            # 10 rapid events per round — slow single wheels stall this list
            # (runs 2026-10-24: 20 rapid events moved ~310px, 1s-apart events
            # ~10-35px each and erratic), so cadence is what accumulates.
            await page.mouse.move(x, y)
            for _ in range(10):
                await page.mouse.wheel(0, dy)
                await asyncio.sleep(0.12)
            await asyncio.sleep(1.0)
    elif verb == "mark":
        await writer.mark(arg)
    else:
        raise ValueError(f"Unknown step: {verb}:{arg}")


class CaptureSession(NamedTuple):
    context: BrowserContext
    page: Page
    guard_task: "asyncio.Task"


async def launch_session(
    playwright: Playwright,
    *,
    profile: str,
    url: str,
    writer: FrameWriter,
    settle: float,
    width: int,
    height: int,
    browser: str,
    headless: bool,
) -> CaptureSession:
    launch_options = {
        "user_data_dir": str(Path(profile)),
        "headless": headless,
        "viewport": {"width": width, "height": height},
        "args": [
            "--disable-blink-features=AutomationControlled",
            "--hide-crash-restore-bubble",
        ],
        "service_workers": "block",
    }
    if browser != "chromium":
        launch_options["channel"] = browser
    context = await playwright.chromium.launch_persistent_context(**launch_options)
    try:
        page = context.pages[0] if context.pages else await context.new_page()
        attach_capture(page, writer)
        context.on("page", lambda p: attach_capture(p, writer))
        page = await navigate_to_game(context, page, url, prepare_page=install_profile_popup_guard)
        guard_task = asyncio.create_task(install_game_core_frame_guard_after_delay(page))
        await asyncio.sleep(settle)
        return CaptureSession(context, page, guard_task)
    except BaseException:
        await context.close()
        raise


async def close_session(session: CaptureSession) -> None:
    session.guard_task.cancel()
    await session.context.close()


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", default=".tmp/m535")
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
                verb, arg = parse_step(spec)
                await run_step(session.page, writer, verb, arg, out_dir)
            if writer.seq:
                print(f"[done] captured {writer.seq} frames -> {out_dir}")
        finally:
            await close_session(session)


if __name__ == "__main__":
    asyncio.run(main())
