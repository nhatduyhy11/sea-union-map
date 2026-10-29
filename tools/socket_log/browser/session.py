"""Persistent-profile game sessions, plus the post-navigation page guards.

launch_game_context() is the one Chrome launch block every tool shares.
open_game_session() layers the WS send hook + navigation + guards on top for the
live loggers / crawlers; launch_session() is the capture-CLI flavour (raw frame
capture on every page, no send hook).
"""

import asyncio
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from pathlib import Path
from typing import NamedTuple

from playwright.async_api import BrowserContext, Page, Playwright

from browser.navigation import navigate_to_game
from browser.page_guards import (
    install_game_core_frame_guard_after_delay,
    install_profile_popup_guard,
)
from browser.ws_inject import WS_SEND_HOOK_JS
from capture.frames import FrameWriter, attach_capture

LAUNCH_ARGS = [
    "--disable-blink-features=AutomationControlled",
    "--hide-crash-restore-bubble",
]


async def launch_game_context(
    playwright: Playwright,
    *,
    profile: str | Path,
    browser: str = "chrome",
    headless: bool = False,
    width: int = 640,
    height: int = 720,
) -> BrowserContext:
    return await playwright.chromium.launch_persistent_context(
        user_data_dir=str(Path(profile)),
        channel=None if browser == "chromium" else browser,
        headless=headless,
        viewport={"width": width, "height": height},
        args=LAUNCH_ARGS,
        service_workers="block",
    )


@asynccontextmanager
async def open_game_session(
    playwright: Playwright,
    *,
    profile: str | Path,
    url: str,
    on_page: Callable[[Page], None],
    browser: str = "chrome",
    headless: bool = False,
    width: int = 640,
    height: int = 720,
) -> AsyncIterator[Page]:
    """Launch the profile with the WS send hook installed, navigate to the game
    and yield the game page; the guard task + context are closed on exit.

    on_page runs for the initial page and every page opened later, BEFORE
    navigation — the game socket opens during it, and Playwright only surfaces
    brand-new sockets.
    """
    context = await launch_game_context(
        playwright, profile=profile, browser=browser, headless=headless, width=width, height=height
    )
    guard_task = None
    try:
        await context.add_init_script(WS_SEND_HOOK_JS)  # covers pages opened later
        page = context.pages[0] if context.pages else await context.new_page()
        on_page(page)
        context.on("page", on_page)

        async def prepare(new_page: Page) -> None:
            await install_profile_popup_guard(new_page)
            # page-level init script: context-level ones don't reach the pre-existing
            # page of a persistent profile (seen 2026-10-23: hook never ran)
            await new_page.add_init_script(WS_SEND_HOOK_JS)

        page = await navigate_to_game(context, page, url, prepare_page=prepare)
        try:
            await page.evaluate(WS_SEND_HOOK_JS)  # belt & suspenders for the current doc
        except Exception as exc:  # noqa: BLE001 — frame not ready yet; heartbeats retrigger send hook
            print(f"[hook] send-hook evaluate skipped: {exc}", flush=True)
        guard_task = asyncio.create_task(install_game_core_frame_guard_after_delay(page))
        yield page
    finally:
        if guard_task is not None:
            guard_task.cancel()
        await context.close()


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
    context = await launch_game_context(
        playwright, profile=profile, browser=browser, headless=headless, width=width, height=height
    )
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
