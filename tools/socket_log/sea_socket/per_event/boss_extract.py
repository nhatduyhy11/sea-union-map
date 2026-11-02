"""Dump the Sea boss catalog (config rows + image assets) — no login needed.

Boots the game page headless, loads the full config (``config.<ver>.bin``, the
same URL as the ``preload_config.<ver>.bin`` resource the page fetches before
login), then for every ``CampGVGMonsterLO`` row writes:

- the monster row, its ``_showBoss`` row in ``CreepLO``, the skill rows
  (``SkillBaseLO``) and buff rows (``SkillBuffLO``, following ``_buffAffect``)
  of that unit, the suggested hero (``HeroLO``), restrain tags (``HeroTagLO``)
  and special attribute names (``AttributeDescLO``) — values as the runtime
  holds them after decoding/localizing, field names untouched;
- every external asset (``ext-res``) whose path carries the boss art token
  taken from ``_avatar``/``_halfPic``/``_model`` (e.g. ``boss_008``). Assets the
  ``CreepLO`` row points at (``shuzhi/<_avatar>``, ``shuzhi/<_halfPic>``,
  ``model/<_model>/``) are ``linked``; the rest only share the token and may
  belong to another unit — ``head/touxiang_boss_008`` is the avatar of a
  ``DemonDreamBossLO`` boss, not of Sea monster 1002 — so they go to ``others/``.

Output::

    <out>/catalog.json              monsterId -> name, showBoss, folder, assets
    <out>/<monsterId>-<model>/info.json
    <out>/<monsterId>-<model>/<ext-res path>          linked, e.g. shuzhi/head/head_boss_008.png
    <out>/<monsterId>-<model>/others/<ext-res path>   token match only

Usage:
    uv run python tools/socket_log/sea_socket/per_event/boss_extract.py --out .tmp/boss-catalog
"""

import argparse
import asyncio
import json
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from playwright.async_api import async_playwright

DEFAULT_URL = "https://hauntedroomvnh5.joynetgame.com/"

# Runs in the page once the preload config URL is known. Returns plain JSON:
# List/Dictionary wrappers of the game are flattened to arrays/objects.
EXTRACT_JS = r"""
async ({ preloadUrl, skipExts }) => {
  const R = (n) => { const m = window.__require(n); return m[n] || m; };
  const buf = new Uint8Array(await (await fetch(preloadUrl.replace("preload_config", "config"))).arrayBuffer());
  const reader = new (R("BinaryReader"))();
  reader.init(R("QuickLZ").decompress(buf));
  new (R("ConfigParser"))().writeBinaryDataWhenRead(reader);

  const plain = (v, depth = 0) => {
    if (v === null || typeof v !== "object" || depth > 6) return v;
    if (typeof v._length === "number") {
      const out = [];
      for (let i = 0; i < v._length; i++) out.push(plain(v[i], depth + 1));
      return out;
    }
    if (Array.isArray(v)) return v.map((x) => plain(x, depth + 1));
    const out = {};
    for (const k of Object.keys(v)) out[k] = plain(v[k], depth + 1);
    return out;
  };
  const row = (table, key) => { const r = R(table).get(key); return r ? plain(r) : null; };
  const rows = (table) => { const c = R(table); return Object.values(c.store._keyList).map((k) => c.get(k)).filter(Boolean); };
  const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } };

  const buffRows = (rootIds) => {
    const out = {}, queue = [...rootIds];
    while (queue.length) {
      const id = queue.shift();
      if (!id || id in out) continue;
      const b = row("SkillBuffLO", id);
      out[id] = b;
      if (b && b._buffAffect) for (const x of b._buffAffect) queue.push(x);
    }
    return Object.values(out).filter(Boolean);
  };

  const em = window.aswallow.extAssetMgr;
  const extKeys = Object.keys(em._verUrlMap);
  const assetsFor = (tokens, creep) => {
    const res = tokens.map((t) => new RegExp("(^|[/_])" + t + "(?![0-9])", "i"));
    const linkedFiles = [creep && creep._avatar, creep && creep._halfPic].filter(Boolean).map((p) => "shuzhi/" + p + ".png");
    const linkedDir = creep && creep._model ? "model/" + creep._model + "/" : null;
    return extKeys
      .filter((k) => res.some((re) => re.test(k)))
      .filter((k) => !skipExts.some((ext) => k.toLowerCase().endsWith(ext)))
      .sort()
      .map((k) => ({
        path: k,
        linked: linkedFiles.includes(k) || (!!linkedDir && k.startsWith(linkedDir)),
        url: new URL(em._transformUrl({ url: k }), location.href).href,
      }));
  };

  return rows("CampGVGMonsterLO").map((m) => {
    const monster = plain(m);
    const creep = row("CreepLO", monster._showBoss);
    const skillIds = creep ? [creep._normalSkill, creep._actSkill, creep._posSkill1, creep._posSkill2,
      creep._posSkill3, ...(parse(creep._pSkills) || [])].filter((x) => x > 0) : [];
    const tokens = [...new Set([creep && creep._avatar, creep && creep._halfPic, creep && creep._model]
      .filter(Boolean)
      .map((p) => { const t = p.split("/").pop().match(/boss_\d+/i); return t ? t[0] : null; })
      .filter(Boolean)
      .map((t) => t.toLowerCase()))];
    return {
      monster,
      creep,
      skills: skillIds.map((id) => row("SkillBaseLO", id) || { _id: id, missing: true }),
      buffs: buffRows(skillIds),
      heroes: (parse(creep && creep._showHeroItem) || []).map((it) => row("HeroLO", it[1])).filter(Boolean),
      restrainTags: (parse(creep && creep._restrainTag) || []).map((code) => row("HeroTagLO", code)).filter(Boolean),
      specialAttrs: (parse(creep && creep._specialAttr) || []).map((it) => row("AttributeDescLO", it[0])).filter(Boolean),
      artTokens: tokens,
      assets: assetsFor(tokens, creep),
    };
  });
}
"""


def fetch(url: str, dest: Path) -> int:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=60) as resp:
        data = resp.read()
    dest.write_bytes(data)
    return len(data)


async def extract(url: str, timeout: float, skip_exts: list[str]) -> list[dict]:
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            channel="chrome",
            headless=True,
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = await browser.new_page(viewport={"width": 640, "height": 720})
        preload: list[str] = []
        page.on("request", lambda r: preload.append(r.url) if "preload_config" in r.url else None)
        await page.goto(url, wait_until="load", timeout=60_000)
        loop = asyncio.get_running_loop()
        deadline = loop.time() + timeout
        ready = False
        print(f"[boss] booting {url} — waiting for preload config + ext-res map")
        while loop.time() < deadline:
            await asyncio.sleep(2.0)
            if preload:
                ready = await page.evaluate(
                    "() => !!(window.__require && window.aswallow && window.aswallow.extAssetMgr"
                    " && Object.keys(window.aswallow.extAssetMgr._verUrlMap || {}).length)")
                if ready:
                    break
        if not ready:
            raise SystemExit("game runtime not ready before timeout")
        bosses = await page.evaluate(EXTRACT_JS, {"preloadUrl": preload[0], "skipExts": skip_exts})
        await browser.close()
    return bosses


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--out", required=True)
    parser.add_argument("--timeout", type=float, default=120.0,
                        help="Seconds to wait for the game runtime to boot")
    parser.add_argument("--skip-ext", action="append", default=[".astc"],
                        help="Asset extensions not downloaded (default: .astc GPU textures)")
    parser.add_argument("--no-assets", action="store_true", help="Write info.json only")
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # boss names are Vietnamese

    out = Path(args.out)
    bosses = asyncio.run(extract(args.url, args.timeout, args.skip_ext))
    catalog = []
    jobs: list[tuple[str, Path]] = []
    for boss in bosses:
        monster, creep = boss["monster"], boss["creep"] or {}
        folder = f"{monster['_id']}-{creep.get('_model') or 'unknown'}"
        boss_dir = out / folder
        boss_dir.mkdir(parents=True, exist_ok=True)
        (boss_dir / "info.json").write_text(json.dumps(boss, ensure_ascii=False, indent=1), encoding="utf-8")
        catalog.append({
            "monsterId": monster["_id"],
            "name": monster["_name"],
            "showBoss": monster["_showBoss"],
            "model": creep.get("_model"),
            "avatar": creep.get("_avatar"),
            "halfPic": creep.get("_halfPic"),
            "folder": folder,
            "assets": [a["path"] for a in boss["assets"] if a["linked"]],
            "otherAssets": [a["path"] for a in boss["assets"] if not a["linked"]],
        })
        jobs += [(a["url"], boss_dir / ("" if a["linked"] else "others") / a["path"]) for a in boss["assets"]]
        print(f"[boss] {monster['_id']} {monster['_name']} -> {folder} "
              f"({len(boss['skills'])} skills, {len(boss['buffs'])} buffs, {len(boss['assets'])} assets)")
    (out / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=1), encoding="utf-8")

    if not args.no_assets:
        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda job: _safe_fetch(*job), jobs))
        failed = [(url, err) for url, err in results if err]
        print(f"[boss] downloaded {len(jobs) - len(failed)}/{len(jobs)} assets")
        for url, err in failed:
            print(f"[boss]   failed {url}: {err}")
    print(f"[boss] wrote {out / 'catalog.json'}")


def _safe_fetch(url: str, dest: Path) -> tuple[str, str | None]:
    try:
        fetch(url, dest)
        return url, None
    except Exception as exc:  # noqa: BLE001 — report and keep going
        return url, str(exc)


if __name__ == "__main__":
    main()
