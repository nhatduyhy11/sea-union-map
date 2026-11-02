"""Render boss spine models from a ``boss_extract.py`` output dir to PNG.

Every ``model/<name>/<name>.json`` under a boss folder (linked model and the
``others/`` variants) is drawn with the official spine-ts 3.8 WebGL runtime
(the models are Spine 3.8.99) in headless Chrome: setup pose, then frame 0 of
each requested animation (default ``daiji`` = idle; the ``zhanshi`` showcase
animation that a few boss models carry is a copy of ``daiji``). The high-res atlas ``<name>_h.atlas`` is used when present.
Textures are premultiplied alpha. Output is flat, cropped to the visible pixels,
prefixed with the monster id of the boss folder::

    <out>/<monsterId>-<name>-<animation>.png   e.g. 1002-Boss_008-daiji.png

Usage:
    uv run python tools/socket_log/sea_socket/per_event/boss_render.py --dir .tmp/boss-catalog --out .tmp/boss-render
"""

import argparse
import asyncio
import base64
import io
import sys
from pathlib import Path

from PIL import Image
from playwright.async_api import async_playwright

SPINE_JS = "https://cdn.jsdelivr.net/gh/EsotericSoftware/spine-runtimes@3.8.95/spine-ts/build/spine-webgl.js"
ORIGIN = "http://boss.local/"

PAGE_HTML = f"""<!doctype html><html><body style="margin:0;background:transparent">
<canvas id="c" width="16" height="16"></canvas>
<script src="{SPINE_JS}"></script></body></html>"""

# Loads one skeleton and returns {animation: dataURL}. The canvas is resized to
# the skeleton bounds per frame; bounds include hidden attachments, so the
# caller crops to the alpha bbox afterwards.
RENDER_JS = r"""
async ({ base, atlas, json, animations, scale }) => {
  const canvas = document.getElementById("c");
  if (!window.__spine) {
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
    const ctx = new spine.webgl.ManagedWebGLRenderingContext(gl);
    window.__spine = { gl, ctx, renderer: new spine.webgl.SceneRenderer(canvas, ctx, true) };
  }
  const { gl, ctx, renderer } = window.__spine;
  const assets = new spine.webgl.AssetManager(ctx, base);
  assets.loadTextureAtlas(atlas);
  assets.loadText(json);
  while (!assets.isLoadingComplete()) await new Promise((r) => setTimeout(r, 50));
  if (assets.hasErrors()) return { error: JSON.stringify(assets.getErrors()) };

  // Some skins reference regions the atlas was packed without; skip them like
  // the game does instead of failing the whole model.
  const loader = new spine.AtlasAttachmentLoader(assets.get(atlas));
  const missing = [];
  for (const fn of ["newRegionAttachment", "newMeshAttachment"]) {
    const orig = loader[fn].bind(loader);
    loader[fn] = (...a) => { try { return orig(...a); } catch (e) { missing.push(a[1]); return null; } };
  }
  const reader = new spine.SkeletonJson(loader);
  reader.scale = scale;
  const data = reader.readSkeletonData(assets.get(json));
  const out = {};
  for (const name of animations) {
    if (!data.findAnimation(name)) continue;
    const skeleton = new spine.Skeleton(data);
    skeleton.setToSetupPose();
    const state = new spine.AnimationState(new spine.AnimationStateData(data));
    state.setAnimation(0, name, false);
    state.apply(skeleton);
    skeleton.updateWorldTransform();
    const offset = new spine.Vector2(), size = new spine.Vector2();
    skeleton.getBounds(offset, size, []);
    const pad = 8;
    canvas.width = Math.min(4096, Math.ceil(size.x) + 2 * pad);
    canvas.height = Math.min(4096, Math.ceil(size.y) + 2 * pad);
    gl.viewport(0, 0, canvas.width, canvas.height);
    renderer.camera.position.x = offset.x + size.x / 2;
    renderer.camera.position.y = offset.y + size.y / 2;
    renderer.camera.viewportWidth = canvas.width;
    renderer.camera.viewportHeight = canvas.height;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    renderer.begin();
    renderer.drawSkeleton(skeleton, true);
    renderer.end();
    out[name] = canvas.toDataURL("image/png");
  }
  assets.dispose();
  return { frames: out, missing };
}
"""


def atlas_page_width(atlas: Path) -> int:
    for line in atlas.read_text(encoding="utf-8").splitlines():
        if line.startswith("size:"):
            return int(line.split(":")[1].split(",")[0])
    return 0


def skeletons(root: Path) -> list[tuple[Path, Path, str, float]]:
    """(json, atlas, monster id, scale) for every spine model under root."""
    found = []
    for json_path in sorted(root.glob("*/model/*/*.json")) + sorted(root.glob("*/others/model/*/*.json")):
        name = json_path.stem
        base_atlas = json_path.with_suffix(".atlas")
        hi_atlas = json_path.with_name(f"{name}_h.atlas")
        if not base_atlas.exists():
            continue
        atlas, scale = base_atlas, 1.0
        if hi_atlas.exists() and atlas_page_width(base_atlas):
            atlas = hi_atlas
            scale = atlas_page_width(hi_atlas) / atlas_page_width(base_atlas)
        monster_id = json_path.relative_to(root).parts[0].split("-")[0]
        found.append((json_path, atlas, monster_id, scale))
    return found


async def render(root: Path, out_dir: Path, animations: list[str]) -> None:
    async def serve(route):
        rel = route.request.url[len(ORIGIN):].split("?")[0]
        if not rel:
            await route.fulfill(body=PAGE_HTML, content_type="text/html")
            return
        path = (root / rel).resolve()
        if root.resolve() not in path.parents or not path.is_file():
            await route.fulfill(status=404)
            return
        await route.fulfill(path=str(path))

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(channel="chrome", headless=True, args=["--use-angle=swiftshader"])
        page = await browser.new_page()
        await page.route(f"{ORIGIN}**", serve)
        await page.goto(ORIGIN)
        await page.wait_for_function("() => !!window.spine")
        out_dir.mkdir(parents=True, exist_ok=True)
        for json_path, atlas, monster_id, scale in skeletons(root):
            rel = lambda p: p.relative_to(root).as_posix()  # noqa: E731
            result = await page.evaluate(RENDER_JS, {
                "base": ORIGIN, "atlas": rel(atlas), "json": rel(json_path),
                "animations": animations, "scale": scale,
            })
            if "error" in result:
                print(f"[render] {rel(json_path)}: {result['error']}")
                continue
            if result["missing"]:
                print(f"[render] {rel(json_path)}: skipped regions not in atlas {result['missing']}")
            for anim, data_url in result["frames"].items():
                img = Image.open(io.BytesIO(base64.b64decode(data_url.split(",", 1)[1]))).convert("RGBA")
                bbox = img.getchannel("A").getbbox()
                if bbox:
                    img = img.crop(bbox)
                dest = out_dir / f"{monster_id}-{json_path.stem}-{anim}.png"
                img.save(dest)
                print(f"[render] {dest.name} {img.size[0]}x{img.size[1]} (scale {scale:g})")
        await browser.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dir", required=True, help="Output dir of boss_extract.py")
    parser.add_argument("--out", required=True, help="Flat dir for the rendered PNGs")
    parser.add_argument("--anim", action="append", default=None,
                        help="Animation to render (repeatable; default: daiji)")
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    asyncio.run(render(Path(args.dir), Path(args.out), args.anim or ["daiji"]))


if __name__ == "__main__":
    main()
