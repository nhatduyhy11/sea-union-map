"""One-off probe: tên của 12 guild score=0 mà 0x24/0x0035 injected trả rỗng.

Bối cảnh (2026-10-27): inject 0x24/0x0035 cho đúng 12 guild score=0 trong BXH
phe luôn trả frame ~14B rỗng, deterministic qua 2 sessions cách nhau ~20 phút;
103 guild còn lại trả bình thường xen kẽ. Nhưng trong game, BXH phe HIỆN tên
các guild này sau vài giây (client tự gọi sv) → server có data, request của
mình chưa đúng hình dạng hoặc cần trạng thái UI.

Probe 3 pha:
  1. Capture thụ động ~idle giây trong khi user mở BXH phe + kéo xuống đáy —
     in live mọi frame S của client (module/cmd/seq) + mọi frame R module 0x24
     để thấy client gọi gì khi tên hiện ra.
  2. Inject baseline 0x24/0x0035 cho 12 gid (1s/request) — so cùng session.
  3. Replay y nguyên raw bytes của các frame 0x24/0x0035 client đã gửi ở pha 1
     (pending future trên đúng seq client dùng) — test "cùng byte, cùng session".

    uv run python tools/socket_log/sea_socket/dead_guild_probe.py --idle 100
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
    parse_guild_brief,
)
from core.runner import SEND_FRAME_JS, WS_SEND_HOOK_JS  # noqa: E402
from sea_socket.crawler import CrawlRouter, LOCK_FILENAME  # noqa: E402
from sea_socket.protocol import iter_frames  # noqa: E402
from sea_socket.walkthrough import STAGES, run_stages  # noqa: E402

DEAD_GIDS = [5160013, 5210021, 5350003, 5380011, 5390014, 5460012,
             5550018, 5550026, 5600018, 5670011, 5730018, 5740012]


def describe_frame(direction: str, payload) -> list[str]:
    lines = []
    if not isinstance(payload, bytes):
        return lines
    try:
        for header, _body in iter_frames(direction, payload):
            mod, cmd = header["module"], header["cmd"]
            if direction == "S":
                lines.append(f"[client-S] mod={mod:#04x} cmd={cmd:#06x} "
                             f"seq={header['seq']:#04x}")
            elif mod == GUILD_MODULE:
                lines.append(f"[client-R] mod={mod:#04x} cmd={cmd:#06x} "
                             f"seq={header['seq']:#04x} status={header['status']}")
    except Exception:  # noqa: BLE001 — monitor phải không bao giờ giết session
        pass
    return lines


async def main(idle_seconds: int) -> None:
    out_dir = Path(".tmp/sea-crawl/dead-guild-probe")
    out_dir.mkdir(parents=True, exist_ok=True)
    profile = Path(".tmp/pmain")
    if not acquire_profile_lock(profile, LOCK_FILENAME):
        print("[lock] busy — đóng Chrome pmain đang mở rồi chạy lại")
        return
    try:
        writer = FrameWriter(out_dir)
        router = CrawlRouter(writer)
        organic: list[tuple[int, bytes]] = []  # (seq, raw payload) 0x24/0x0035 client gửi
        replaying = False  # pha 3: không tự bắt lại frame mình replay (self-feedback)

        def on_ws(ws: WebSocket) -> None:
            router.attach(ws, ws.url)

            async def watch(direction: str, payload) -> None:
                for line in describe_frame(direction, payload):
                    print(line, flush=True)
                if direction != "S" or not isinstance(payload, bytes):
                    return
                if replaying:
                    return
                try:
                    for header, body in iter_frames("S", payload):
                        if (header["module"] == GUILD_MODULE
                                and header["cmd"] == GUILD_BRIEF_CMD):
                            organic.append((header["seq"], payload))
                            print(f"[organic] 0x24/0x0035 seq={header['seq']:#04x} "
                                  f"{len(payload)}B — đã lưu để replay", flush=True)
                except Exception:  # noqa: BLE001
                    pass

            ws.on("framesent", lambda p: asyncio.ensure_future(watch("S", p)))
            ws.on("framereceived", lambda p: asyncio.ensure_future(watch("R", p)))

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

                    print(f"=== [1] PASSIVE {idle_seconds}s — MỞ BXH PHE + KÉO XUỐNG "
                          "ĐÁY NGAY BÂY GIỜ, đợi tên hiện", flush=True)
                    await asyncio.sleep(idle_seconds)

                    print("=== [2] baseline inject 12 gid (1s/request)", flush=True)
                    for gid in DEAD_GIDS:
                        try:
                            _h, body = await router.inject(
                                page, GUILD_MODULE, GUILD_BRIEF_CMD, [(1, gid)])
                            brief = parse_guild_brief(body)
                            tag = "ĐỦ" if brief["name"] else "RỖNG"
                            print(f"  {gid}: {tag} {len(body)}B "
                                  f"{json.dumps(brief, ensure_ascii=False)[:120]}",
                                  flush=True)
                        except RuntimeError as exc:
                            print(f"  {gid}: {exc}", flush=True)
                        await asyncio.sleep(1.0)

                    print(f"=== [3] replay {len(organic)} frame organic client",
                          flush=True)
                    replaying = True
                    for seq, raw in organic:
                        fut: asyncio.Future = asyncio.get_running_loop().create_future()
                        router.pending[seq] = fut
                        await page.evaluate(SEND_FRAME_JS, list(raw))
                        try:
                            _h, body = await asyncio.wait_for(fut, 10)
                            brief = parse_guild_brief(body)
                            tag = "ĐỦ" if brief["name"] else "RỖNG"
                            print(f"  replay seq={seq:#04x}: {tag} {len(body)}B "
                                  f"{json.dumps(brief, ensure_ascii=False)[:120]}",
                                  flush=True)
                        except asyncio.TimeoutError:
                            router.pending.pop(seq, None)
                            print(f"  replay seq={seq:#04x}: TIMEOUT", flush=True)
                        await asyncio.sleep(1.0)
                finally:
                    guard.cancel()
            finally:
                await context.close()
    finally:
        release_profile_lock(profile, LOCK_FILENAME)


if __name__ == "__main__":
    idle = 100
    if "--idle" in sys.argv:
        idle = int(sys.argv[sys.argv.index("--idle") + 1])
    asyncio.run(main(idle))
