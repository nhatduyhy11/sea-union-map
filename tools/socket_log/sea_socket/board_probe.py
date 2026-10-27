"""Probe the rank server for board ids/sub-ids the crawler doesn't pull.

The web BXH needs a server-side GUILD board (tab Phe drill-down) that no
crawl has captured yet: board 116 returns 4 faction rows, 117 the top-200
players, 118 per-node. This tool logs in, injects 0x0c/0x0002 for a list of
candidate (f1, f2) pairs, decodes each answer with the game runtime and
prints the shape — enough to spot a guild board (rows with id_type=3-ish
addition_info) or an error pattern.

    uv run python tools/socket_log/sea_socket/board_probe.py --profile .tmp/pmain
"""

import asyncio
import base64
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from playwright.async_api import Page, WebSocket, async_playwright

from browser.navigation import navigate_to_game  # noqa: E402
from browser.page_guards import (  # noqa: E402
    install_game_core_frame_guard_after_delay,
    install_profile_popup_guard,
)
from browser.process_guard import acquire_profile_lock, release_profile_lock  # noqa: E402
from capture.capture import FrameWriter  # noqa: E402
from core.runner import SEND_FRAME_JS, WS_SEND_HOOK_JS  # noqa: E402
from sea_socket.crawler import (  # noqa: E402
    DECODE_BOARDS_JS,
    CrawlRouter,
    LOCK_FILENAME,
    inject_retrying,
)
from sea_socket.protocol import RANK_CMD, RANK_MODULE  # noqa: E402
from sea_socket.walkthrough import STAGES, run_stages  # noqa: E402

REQUEST_PACE = 0.4

# (f1, f2) — None f2 = omit the field, like the crawler's 116/117 requests.
CANDIDATES: list[tuple[int, int | None]] = [
    (116, None),          # baseline: BXH phe (4 faction rows)
    (116, 1), (116, 2), (116, 3), (116, 4),   # per-faction? guild drill?
    (117, None),          # baseline: BXH điểm
    (117, 1),
    (119, None), (120, None), (115, None), (114, None),  # uncharted ids
    (121, None), (122, None),
]


def board_throttled(_header, body) -> bool:
    return len(body) < 24  # err body: 12B compressed; real boards ≥ 32B


async def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", default=".tmp/pmain")
    parser.add_argument("--url", default="https://hauntedroomvnh5.joynetgame.com/")
    parser.add_argument("--browser", default="chrome")
    parser.add_argument("--settle", type=float, default=6.0)
    args = parser.parse_args()

    out_dir = Path(".tmp/sea-crawl/board-probe")
    out_dir.mkdir(parents=True, exist_ok=True)
    profile = Path(args.profile)
    if not acquire_profile_lock(profile, LOCK_FILENAME):
        print(f"[lock] {profile} is busy ({LOCK_FILENAME} held) — refusing to run")
        return
    try:
        entry_stages = [stage for stage in STAGES if stage[0] == "login"]
        writer = FrameWriter(out_dir)
        router = CrawlRouter(writer)

        async with async_playwright() as playwright:
            context = await playwright.chromium.launch_persistent_context(
                user_data_dir=str(profile),
                channel=args.browser if args.browser != "chromium" else None,
                viewport={"width": 640, "height": 720},
                args=["--disable-blink-features=AutomationControlled",
                      "--hide-crash-restore-bubble"],
                service_workers="block",
            )
            try:
                page = context.pages[0] if context.pages else await context.new_page()

                async def prepare(new_page: Page) -> None:
                    await install_profile_popup_guard(new_page)
                    await new_page.add_init_script(WS_SEND_HOOK_JS)

                def on_websocket(ws: WebSocket) -> None:
                    router.attach(ws, ws.url)

                page.on("websocket", on_websocket)
                context.on("page", lambda p: p.on("websocket", on_websocket))
                page = await navigate_to_game(context, page, args.url, prepare_page=prepare)
                try:
                    await page.evaluate(WS_SEND_HOOK_JS)
                except Exception:  # noqa: BLE001
                    pass
                guard_task = asyncio.create_task(
                    install_game_core_frame_guard_after_delay(page))
                await asyncio.sleep(args.settle)

                try:
                    await run_stages(page, writer, out_dir, entry_stages)
                    results = {}
                    for f1, f2 in CANDIDATES:
                        fields = [(1, f1)] + ([(2, f2)] if f2 is not None else [])
                        key = f"{f1}-{f2 if f2 is not None else 'x'}"
                        try:
                            _h, body, retries = await inject_retrying(
                                page, router, RANK_MODULE, RANK_CMD,
                                fields, board_throttled)
                            results[key] = {
                                "fields": fields,
                                "retries": retries,
                                "compress": _h["status"] == 1,
                                "b64": base64.b64encode(body).decode(),
                            }
                            print(f"[probe] {key}: {len(body)}B (retries {retries})",
                                  flush=True)
                        except Exception as exc:  # noqa: BLE001
                            print(f"[probe] {key}: FAILED {exc}", flush=True)
                        await asyncio.sleep(REQUEST_PACE)

                    inputs = [
                        {"key": [int(p) for p in key.split("-") if p != "x"],
                         "b64": r["b64"], "compress": r["compress"]}
                        for key, r in results.items()
                    ]
                    decoded = await page.evaluate(DECODE_BOARDS_JS, inputs)
                    report = {}
                    for item, row in zip(inputs, decoded):
                        key = "-".join(str(x) for x in item["key"]) or "?"
                        if "error" in row:
                            report[key] = {"error": row["error"]}
                        else:
                            report[key] = {
                                "err": row["err"], "id_type": row["id_type"],
                                "n_rows": len(row["rows"]),
                                "self": row["self"],
                                "first_rows": row["rows"][:3],
                            }
                    (out_dir / "probe-decoded.json").write_text(
                        json.dumps(report, ensure_ascii=False, indent=1),
                        encoding="utf-8")
                    for key, r in report.items():
                        if "error" in r:
                            print(f"[decode] {key}: ERROR {r['error']}")
                        else:
                            print(f"[decode] {key}: err={r['err']} "
                                  f"id_type={r['id_type']} rows={r['n_rows']}")
                finally:
                    guard_task.cancel()
            finally:
                await context.close()
    finally:
        release_profile_lock(profile, LOCK_FILENAME)


if __name__ == "__main__":
    asyncio.run(main())
