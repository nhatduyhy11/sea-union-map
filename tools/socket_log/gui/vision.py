"""Golden lookup + grayscale template matching on page screenshots."""

import io
from pathlib import Path

from PIL import Image

GOLDENS_DIR = Path(__file__).resolve().parent / "goldens"
DOCS_SEA_ASSETS = Path(__file__).resolve().parents[3] / "docs" / "assets" / "sea-socket"


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
