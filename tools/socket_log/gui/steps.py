"""Step DSL:
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
                 Golden lookup: tools/socket_log/gui/goldens/<GOLDEN>.png, then
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
    popclose[:ROUNDS,MIN,PAUSE]  dismiss the login splash-popup queue
                 (gui/popclose.py; default 4 rounds, checkbox MIN 0.97, 2s pause)
    mark:LABEL   write a marker line into index.jsonl (correlate frames later)
"""

import asyncio
import io
from pathlib import Path
from typing import TYPE_CHECKING

from PIL import Image

from gui.popclose import popclose
from gui.vision import best_crop_position, resolve_golden, screen_similarity

if TYPE_CHECKING:
    from capture.frames import FrameWriter


def parse_step(spec: str) -> tuple[str, str]:
    verb, _, arg = spec.partition(":")
    return verb.strip().lower(), arg


async def _fail_shot(page, out_dir: Path, kind: str, name: str) -> Path:
    fail = out_dir / "screens" / f"FAIL-{kind}-{name.replace('/', '-')}.png"
    fail.parent.mkdir(parents=True, exist_ok=True)
    await page.screenshot(path=str(fail))
    return fail


async def _wheel_burst(page, x: int, y: int, dx: int, dy: int, n: int) -> None:
    await page.mouse.move(x, y)
    for _ in range(n):
        await page.mouse.wheel(dx, dy)
        await asyncio.sleep(0.12)


async def _sleep(page, writer, arg: str, out_dir: Path) -> None:
    await asyncio.sleep(float(arg))


async def _shot(page, writer, arg: str, out_dir: Path) -> None:
    path = out_dir / "screens" / f"{arg}.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    await page.screenshot(path=str(path))
    print(f"[shot] {path}")


async def _click(page, writer, arg: str, out_dir: Path) -> None:
    x_s, _, y_s = arg.partition(",")
    await page.mouse.click(int(x_s), int(y_s))
    print(f"[click] ({x_s},{y_s})")
    await asyncio.sleep(1.0)


async def _scroll(page, writer, arg: str, out_dir: Path) -> None:
    parts = [p.strip() for p in arg.split(",")]
    x_s, y_s, dx_s, dy_s = parts[:4]
    n = int(parts[4]) if len(parts) > 4 else 1
    await _wheel_burst(page, int(x_s), int(y_s), int(dx_s), int(dy_s), n)
    print(f"[scroll] ({x_s},{y_s}) dx={dx_s} dy={dy_s} x{n}")
    await asyncio.sleep(1.0)


async def _expect(page, writer, arg: str, out_dir: Path) -> None:
    name, _, min_s = arg.partition(",")
    minimum = float(min_s) if min_s else 0.95
    golden = resolve_golden(name)
    score = await screen_similarity(page, golden)
    if score < minimum:
        fail = await _fail_shot(page, out_dir, "expect", name)
        raise RuntimeError(
            f"unexpected screen: {score:.3f} < {minimum} vs {golden.name}; evidence: {fail}"
        )
    print(f"[expect] {name} {score:.3f} >= {minimum}")


async def _seek(page, writer, arg: str, out_dir: Path) -> None:
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
            fail = await _fail_shot(page, out_dir, "seek", name)
            raise RuntimeError(
                f"seek: '{name}' not found after {n} scrolls "
                f"(best {score:.3f} < {minimum}); evidence: {fail}"
            )
        print(f"[seek] {name}: best {score:.3f} < {minimum}, scroll {attempt + 1}/{n}")
        # 10 rapid events per round — slow single wheels stall this list
        # (runs 2026-10-24: 20 rapid events moved ~310px, 1s-apart events
        # ~10-35px each and erratic), so cadence is what accumulates.
        await _wheel_burst(page, x, y, 0, dy, 10)
        await asyncio.sleep(1.0)


async def _popclose(page, writer, arg: str, out_dir: Path) -> None:
    await popclose(page, arg)


async def _mark(page, writer, arg: str, out_dir: Path) -> None:
    await writer.mark(arg)


STEPS = {
    "sleep": _sleep,
    "shot": _shot,
    "click": _click,
    "scroll": _scroll,
    "expect": _expect,
    "seek": _seek,
    "popclose": _popclose,
    "mark": _mark,
}


async def run_step(page, writer: "FrameWriter", verb: str, arg: str, out_dir: Path) -> None:
    handler = STEPS.get(verb)
    if handler is None:
        raise ValueError(f"Unknown step: {verb}:{arg}")
    await handler(page, writer, arg, out_dir)
