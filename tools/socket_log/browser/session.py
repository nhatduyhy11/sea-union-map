"""Persistent-profile game session with WebSocket capture attached to every
page (initial + popups), plus the post-navigation page guards."""

import asyncio
from pathlib import Path
from typing import NamedTuple

from playwright.async_api import BrowserContext, Page, Playwright

from browser.navigation import navigate_to_game
from browser.page_guards import (
    install_game_core_frame_guard_after_delay,
    install_profile_popup_guard,
)
from capture.frames import FrameWriter, attach_capture


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
