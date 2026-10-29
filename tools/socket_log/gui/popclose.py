"""popclose step: dismiss the queue of event splash popups on login."""

import asyncio
import io

from PIL import Image

from gui.vision import GOLDENS_DIR, best_crop_position

# Splash-checkbox matcher for the popclose verb (2026-10-26 war-day queue of
# no-X event splash popups). Language agnostic on purpose: the template is the
# small empty "don't remind me today" square (goldens/popup-checkbox.png) —
# one UI component across splashes, while the label text differs per
# event/locale. Calibrated on the 2026-10-26 runs: splash hits 0.981-0.983,
# cleanest non-popup screen 0.955 (outside the strip) — 0.97 separates; the
# checked state scores ~0.93, so a ticked box never re-matches. Every splash
# puts the checkbox in the bottom strip, so the scan stays there.
POPUP_STRIP = (180, 560, 420, 700)
POPUP_CHECKBOX_MIN = 0.97
# Popup X close-button ("Thông Báo" clipboard, 2026-10-27 FAIL-login.png):
# golden cropped from the only capture of it — the account that sees the popup
# can't re-show it the same day, so the FAIL shot is the asset source.
# Calibrated on that run: self-match 0.955 (the X sits at odd coords, so the
# (2,2) window grid tops out 1px off — pixel-exact only at (1,1)), cleanest
# screen 0.893 — 0.93 separates. NOT the checkbox threshold: splash checkboxes
# self-match ≥0.981, this button doesn't reach 0.97 even against itself. The
# boss/board popup X's are different assets (mutual aligned score 0.73-0.80) —
# don't reuse their shots as the golden.
POPUP_X_MIN = 0.93
# Outside-click point: the bottom-nav event icon (owner call 2026-10-26).
# While a splash covers the screen the modal overlay swallows the click
# (corner margins (600,90)/(320,40) closed only part of the queue and, once
# the queue drained, stray clicks there opened unrelated screens — run
# 132157 landed in the Shop). Once the queue is gone the same click IS the
# canonical entry into the "Lối vào PB" event lobby — close and navigate in
# one gesture.
POPUP_OUTSIDE = (424, 688)


async def popclose(page, arg: str) -> None:
    # Dismiss splash popups: per round, check the "don't remind" checkbox
    # first (visual template match — never text search), then close via the
    # red-circle X template when present (goldens/popup-x.png — the
    # "Thông Báo" clipboard ships one; the 2026-10-26 war-day splashes
    # didn't), else an outside click on the dark overlay above the popup
    # frame. Fixed round count:
    # the queue pops one splash after another (~2s apart), and a no-match
    # round degrades to a harmless background click.
    parts = [p.strip() for p in arg.split(",")]
    rounds = int(parts[0]) if parts and parts[0] else 4
    minimum = float(parts[1]) if len(parts) > 1 else POPUP_CHECKBOX_MIN
    pause = float(parts[2]) if len(parts) > 2 else 2.0
    checkbox = Image.open(GOLDENS_DIR / "popup-checkbox.png")
    x_path = GOLDENS_DIR / "popup-x.png"
    x_tmpl = Image.open(x_path) if x_path.exists() else None
    sx, sy, ex, ey = POPUP_STRIP
    quiet = 0  # consecutive rounds with no checkbox — stop after 3: the
    # queue pops seconds apart and a fresh profile paints it slowly (run
    # 133912: popclose ended at t+20s while the U Độ splash only painted
    # after it), and every further outside click risks opening an
    # unrelated screen (run 132157: stray post-drain clicks hit the Shop).
    for attempt in range(rounds):
        live = Image.open(io.BytesIO(await page.screenshot()))
        score, bx, by = best_crop_position(live.crop((sx, sy, ex, ey)), checkbox,
                                           x_step=2, y_step=2)
        if score >= minimum:
            quiet = 0
            # click the LABEL right of the square, not the square itself:
            # "Bỏ qua" (Vua popup) closes on a label click but merely
            # toggles on a square click (run 133352 vs 124103), and the
            # splash checkbox toggles either way (124313). A ticked box
            # never re-matches (~0.93), so no accidental untick.
            cx, cy = bx + sx + checkbox.width // 2 + 40, by + sy + checkbox.height // 2
            await page.mouse.click(cx, cy)
            print(f"[popclose] checkbox {score:.3f} at ({cx},{cy}) — ticked+label")
            await asyncio.sleep(0.5)
        else:
            quiet += 1
            if quiet >= 3:
                print(f"[popclose] queue drained after {attempt} round(s)")
                break
        closed = False
        if x_tmpl is not None:
            # Fine grid like the checkbox scan — at the default (24,6) the
            # window lattice skips the ~44px button entirely (2026-10-27
            # probe: best landing 297px off the real X).
            xs, xbx, xby = best_crop_position(live, x_tmpl, x_step=2, y_step=2)
            if xs >= POPUP_X_MIN:
                await page.mouse.click(xbx + x_tmpl.width // 2, xby + x_tmpl.height // 2)
                print(f"[popclose] X icon {xs:.3f} at ({xbx},{xby}) — closed")
                closed = True
                await asyncio.sleep(1.0)
        if not closed:
            await page.mouse.click(*POPUP_OUTSIDE)
            print(f"[popclose] round {attempt + 1}/{rounds}: outside overlay "
                  f"close (checkbox {score:.3f})")
        await asyncio.sleep(pause)
