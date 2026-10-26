"""Dump client config tables (LO stores) from the game bundle — no login needed.

Boots the game page headless, waits for the remote config bundle to load, then
reads ``window.__require("<TABLE>").<TABLE>.store`` per requested table and
writes JSON. Bundle hashes (``index.*.js``/``config.*.bin``) rotate per deploy,
so booting the real page sidesteps versioning entirely — see
docs/SEA_PACKET_ANALYSE.md §4 for the bundle-chain background.

Usage:
    uv run python tools/socket_log/sea_config_extract.py --table CampGVGLO \
        --out .tmp/sea-crawl/campgvglo.json
"""

import argparse
import asyncio
import json
from pathlib import Path

from playwright.async_api import async_playwright

DEFAULT_URL = "https://hauntedroomvnh5.joynetgame.com/"

# Cycle-safe stringify: some stores hold back-references; drop what JSON can't
# encode instead of failing the whole dump.
DUMP_TABLE_JS = """
(table) => {
    const mod = window.__require(table);
    const cls = mod && mod[table];
    if (!cls || !cls.store) return { missing: true };
    // Store shells exist before the config bundle finishes loading — only
    // accept the dump once real data rows (non-underscore keys) are present.
    const dataKeys = Object.keys(cls.store).filter((k) => !k.startsWith("_"));
    if (!dataKeys.length) return { missing: true };
    const seen = new WeakSet();
    const safe = (key, value) => {
        if (typeof value === "object" && value !== null) {
            if (seen.has(value)) return "[circular]";
            seen.add(value);
        }
        return value;
    };
    try {
        return { rows: JSON.parse(JSON.stringify(cls.store, safe)) };
    } catch (err) {
        return { error: String(err) };
    }
}
"""


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--table", action="append", default=[], required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--timeout", type=float, default=120.0,
                        help="Seconds to wait for the config bundle to load")
    args = parser.parse_args()

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            channel="chrome",
            headless=True,
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = await browser.new_page(viewport={"width": 640, "height": 720})
        await page.goto(args.url, wait_until="load", timeout=60_000)
        dumped: dict[str, object] = {}
        loop = asyncio.get_running_loop()
        deadline = loop.time() + args.timeout
        pending = list(args.table)
        print(f"[config] booting {args.url} — waiting for {len(pending)} table(s)")
        while pending and loop.time() < deadline:
            await asyncio.sleep(2.0)
            for table in list(pending):
                try:
                    result = await page.evaluate(DUMP_TABLE_JS, table)
                except Exception as exc:  # noqa: BLE001 — bundle not ready yet
                    if loop.time() > deadline - 2:
                        print(f"[config] {table}: evaluate failed — {exc}")
                    continue
                if result and not result.get("missing"):
                    if "rows" in result:
                        dumped[table] = result["rows"]
                        print(f"[config] {table}: dumped "
                              f"{len(result['rows']) if hasattr(result['rows'], '__len__') else '?'} rows")
                    else:
                        dumped[table] = result
                        print(f"[config] {table}: store not JSON-able — {result.get('error')}")
                    pending.remove(table)
        await browser.close()

    if pending:
        raise SystemExit(f"tables not found before timeout: {pending}")
    out_path.write_text(json.dumps(dumped, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"[config] wrote {out_path}")


if __name__ == "__main__":
    asyncio.run(main())
