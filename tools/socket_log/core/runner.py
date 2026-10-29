"""Shared runner core for the live event loggers (mine today).

Owns everything event-independent: profile lock + stop signals, the
persistent-Chrome session (browser/session.py open_game_session), WebSocket
hookup, the player/guild name service (core/names.py — this module only
forwards frames to it), and the run modes (forever / --duration / --snapshot).
An event logger plugs in its own sinks + frame routing through a routes factory
returning FrameRoutes — see mine_socket/handlers.py for the mine wiring.
"""

import asyncio
import pathlib
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from dataclasses import dataclass

from playwright.async_api import Page, Playwright, WebSocket, async_playwright

from browser.process_guard import (
    acquire_profile_lock,
    install_stop_signals,
    release_profile_lock,
)
from browser.session import open_game_session
from core.names import NameService
from core.sinks import JsonlSink

DEFAULT_LOCK_FILENAME = ".ws_logger.lock"


@dataclass
class LoggerContext:
    """Shared per-run handles an event logger's routes can use."""

    names: NameService
    page: Page | None = None  # game page; set once navigation lands


@dataclass
class FrameRoutes:
    """Event-specific wiring plugged into the core's websocket + run loop."""

    on_frame: Callable[[bytes], None] | None = None
    on_sent: Callable[[bytes], None] | None = None
    snapshot_done: Callable[[], Awaitable[bool]] | None = None  # --snapshot completion check


async def reload_later(page: Page, delay: float = 10.0) -> None:
    await asyncio.sleep(delay)
    try:
        await page.reload(wait_until="commit", timeout=15_000)
        print("[ws close] page reloaded")
    except Exception as exc:  # noqa: BLE001 — any reload failure just gets logged
        print(f"[ws close] reload failed: {exc}")


class GameLogger:
    """Run one event-logging session: browser, sockets, name service, run modes.

    args is the namespace built by core.args.build_parser() (+ any event
    args); the core reads profile, url, dir, briefs, guilds, no_fetch_names,
    snapshot, snapshot_timeout, duration from it.
    """

    def __init__(
        self,
        args,
        routes_factory: Callable[[LoggerContext], FrameRoutes],
        *,
        lock_filename: str = DEFAULT_LOCK_FILENAME,
    ) -> None:
        self.args = args
        self.routes_factory = routes_factory
        self.lock_filename = lock_filename
        self._bg_tasks: set[asyncio.Task] = set()

    async def run(self) -> LoggerContext:
        args = self.args
        profile_dir = pathlib.Path(args.profile)
        if not acquire_profile_lock(profile_dir, self.lock_filename):
            raise SystemExit(1)
        try:
            names = NameService(
                JsonlSink(args.briefs or args.dir / "player-briefs.jsonl", "brief"),
                JsonlSink(args.guilds or args.dir / "guild-briefs.jsonl", "guild"),
                enabled=not args.no_fetch_names,
            )
            stop = asyncio.Event()
            install_stop_signals(stop)
            ctx = LoggerContext(names=names)
            routes = self.routes_factory(ctx)

            async with async_playwright() as playwright, self._open_browser(playwright, ctx, routes):
                try:
                    await self._wait_until_done(routes, stop)
                finally:
                    for task in self._bg_tasks:
                        task.cancel()
        finally:
            release_profile_lock(profile_dir, self.lock_filename)
        return ctx

    @asynccontextmanager
    async def _open_browser(
        self,
        playwright: Playwright,
        ctx: LoggerContext,
        routes: FrameRoutes,
    ) -> AsyncIterator[Page]:
        """Open the game session with every page wired into the socket hookup."""

        def hook(new_page: Page) -> None:
            # Do NOT rebind names here: any popup would steal it and die
            # with the popup. The game-socket "ws open" path binds instead.
            print(f"[page] opened: {new_page.url or '(about:blank)'}", flush=True)
            new_page.on(
                "close",
                lambda p: print(f"[page] closed: {p.url or '(about:blank)'}", flush=True),
            )
            new_page.on(
                "websocket",
                lambda ws: self._on_websocket(ws, new_page, ctx, routes),
            )

        async with open_game_session(
            playwright, profile=self.args.profile, url=self.args.url, on_page=hook
        ) as page:
            ctx.page = page
            if ctx.names.page is None:
                ctx.names.bind(page)  # provisional; the game-socket open binds authoritatively
            yield page

    async def _wait_until_done(self, routes: FrameRoutes, stop: asyncio.Event) -> None:
        args = self.args
        if args.snapshot:
            loop = asyncio.get_running_loop()
            deadline = loop.time() + args.snapshot_timeout
            print(f"[logger] snapshot mode — stop when done (max {args.snapshot_timeout:.0f}s)")
            while loop.time() < deadline:
                await asyncio.sleep(1)
                if routes.snapshot_done is None or await routes.snapshot_done():
                    break
            else:
                print("[logger] snapshot timeout — exiting with partial data")
        elif args.duration:
            print(f"[logger] running for {args.duration}s...")
            try:
                await asyncio.wait_for(stop.wait(), timeout=args.duration)
            except asyncio.TimeoutError:
                pass
        else:
            print("[logger] running forever — Ctrl+C or closing the terminal stops it")
            await stop.wait()

    def _on_websocket(
        self,
        ws: WebSocket,
        page: Page,
        ctx: LoggerContext,
        routes: FrameRoutes,
    ) -> None:
        print(f"[ws open] {ws.url}", flush=True)
        # The :19005 handshake socket always closes right after redirecting to the
        # game socket — only the game socket closing means we lost the session.
        is_game_socket = "nodeName=" in ws.url
        if is_game_socket:
            ctx.names.bind(page)  # injection must target the page owning this socket

        def on_sent(payload) -> None:
            if not isinstance(payload, bytes):
                return
            ctx.names.on_sent(payload)
            if routes.on_sent is not None:
                routes.on_sent(payload)

        def on_frame(payload) -> None:
            if not isinstance(payload, bytes):
                return
            ctx.names.on_frame(payload)
            if routes.on_frame is not None:
                routes.on_frame(payload)

        def on_close() -> None:
            if not is_game_socket:
                return
            print("[ws close] game socket dropped; reloading page in 10s...", flush=True)
            task = asyncio.create_task(reload_later(page))
            self._bg_tasks.add(task)
            task.add_done_callback(self._bg_tasks.discard)

        ws.on("framereceived", on_frame)
        ws.on("framesent", on_sent)
        ws.on("close", on_close)
