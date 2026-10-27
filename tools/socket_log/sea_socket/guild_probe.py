"""One-off probe: guild briefs (0x0d/0x0035) + last-ditch brief retries.

Answers two open questions from the 2026-10-27 session:
1. Does the guild brief endpoint name guilds whose members were all
   brief-refused (5140005 & co show as #id in the web faction board)?
2. Are the 16 brief-refused S513/S514 players really deterministically
   refused — dedicated 16-id batch, size-1 batches and 5s pacing included?

    uv run python tools/socket_log/sea_socket/guild_probe.py --profile .tmp/pmain
"""

import asyncio
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
from core.protocol import (  # noqa: E402
    GUILD_BRIEF_CMD,
    GUILD_MODULE,
    PLAYER_BRIEF_CMD,
    parse_guild_brief,
)
from core.runner import SEND_FRAME_JS, WS_SEND_HOOK_JS  # noqa: E402
from sea_socket.crawler import CrawlRouter, LOCK_FILENAME  # noqa: E402
from sea_socket.protocol import build_brief_frame  # noqa: E402
from sea_socket.walkthrough import STAGES, run_stages  # noqa: E402

GUILD_IDS = [5170010, 5320011, 5140005, 5130004, 5310007, 5260004]
REFUSED = [
    51305171, 51406419, 51406897, 51416289, 51426019, 51426619,
    51436684, 51436910, 51446004, 51446598, 51446910, 51456997,
    51466198, 51476884, 51496319, 51496982,
]


async def main() -> None:
    out_dir = Path(".tmp/sea-crawl/guild-probe")
    out_dir.mkdir(parents=True, exist_ok=True)
    profile = Path(".tmp/pmain")
    if not acquire_profile_lock(profile, LOCK_FILENAME):
        print("[lock] busy")
        return
    try:
        writer = FrameWriter(out_dir)
        router = CrawlRouter(writer)
        async with async_playwright() as p:
            context = await p.chromium.launch_persistent_context(
                user_data_dir=str(profile), channel="chrome",
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

                def on_ws(ws: WebSocket) -> None:
                    router.attach(ws, ws.url)

                page.on("websocket", on_ws)
                context.on("page", lambda x: x.on("websocket", on_ws))
                page = await navigate_to_game(
                    context, page, "https://hauntedroomvnh5.joynetgame.com/",
                    prepare_page=prepare)
                try:
                    await page.evaluate(WS_SEND_HOOK_JS)
                except Exception:  # noqa: BLE001
                    pass
                guard = asyncio.create_task(
                    install_game_core_frame_guard_after_delay(page))
                await asyncio.sleep(6)
                try:
                    await run_stages(page, writer, out_dir,
                                     [s for s in STAGES if s[0] == "login"])

                    print("=== [1] guild briefs 0x0d/0x0035", flush=True)
                    for gid in GUILD_IDS:
                        _h, body = await router.inject(
                            page, GUILD_MODULE, GUILD_BRIEF_CMD, [(1, gid)])
                        briefs = parse_guild_brief(body)
                        print(f"guild {gid}: {json.dumps(briefs, ensure_ascii=False)[:200]}",
                              flush=True)
                        await asyncio.sleep(0.5)

                    print("=== [2] refused players, dedicated 16-id batch", flush=True)
                    seq = router.next_seq()
                    fut: asyncio.Future = asyncio.get_running_loop().create_future()
                    router.pending[seq] = fut
                    frame = build_brief_frame(seq, REFUSED)
                    await page.evaluate(SEND_FRAME_JS, list(frame))
                    try:
                        _h, body = await asyncio.wait_for(fut, 10)
                        print(f"16-id batch: status={_h['status']} body={len(body)}B",
                              flush=True)
                    except asyncio.TimeoutError:
                        router.pending.pop(seq, None)
                        print("16-id batch: TIMEOUT", flush=True)

                    print("=== [3] refused players, size-1 batches, 5s pace", flush=True)
                    for pid in REFUSED[:4]:
                        seq = router.next_seq()
                        fut = asyncio.get_running_loop().create_future()
                        router.pending[seq] = fut
                        await page.evaluate(
                            SEND_FRAME_JS, list(build_brief_frame(seq, [pid])))
                        try:
                            _h, body = await asyncio.wait_for(fut, 10)
                            print(f"id {pid}: status={_h['status']} body={len(body)}B",
                                  flush=True)
                        except asyncio.TimeoutError:
                            router.pending.pop(seq, None)
                            print(f"id {pid}: TIMEOUT", flush=True)
                        await asyncio.sleep(5)
                finally:
                    guard.cancel()
            finally:
                await context.close()
    finally:
        release_profile_lock(profile, LOCK_FILENAME)


if __name__ == "__main__":
    asyncio.run(main())
