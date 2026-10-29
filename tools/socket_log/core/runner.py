"""Shared runner core for the live event loggers (mine and sea today).

Owns everything event-independent: profile lock + stop signals, the
persistent-Chrome session, WebSocket hookup, JSONL sinks, player/guild name
fetching (injected 0x0d/0x001f brief requests), and the run modes (forever /
--duration / --snapshot). An event logger plugs in its own sinks + frame
routing through a routes factory returning FrameRoutes — see
mine_socket/handlers.py for the mine wiring.
"""

import asyncio
import pathlib
import struct
from dataclasses import dataclass
from typing import Awaitable, Callable, Optional

from playwright.async_api import Page, WebSocket, async_playwright

from core.protocol import (
    GUILD_BRIEF_CMD,
    GUILD_BRIEF_LIST_CMD,
    GUILD_MODULE,
    PLAYER_BRIEF_CMD,
    PLAYER_BRIEF_LIST_CMD,
    PLAYER_MODULE,
    build_brief_request,
    frame_is,
    parse_guild_brief,
    parse_player_briefs,
)
from browser.navigation import navigate_to_game
from browser.page_guards import (
    install_game_core_frame_guard_after_delay,
    install_profile_popup_guard,
)
from browser.process_guard import (
    acquire_profile_lock,
    install_stop_signals,
    release_profile_lock,
)
from browser.ws_inject import SEND_FRAME_JS, WS_SEND_HOOK_JS
from core.decode import decode_proto, read_packed_varints, split_frame
from core.sinks import JsonlSink

BRIEF_CHUNK = 60  # client batches ~59 ids per request
NAME_FETCH_MIN_INTERVAL = 5.0  # seconds between injected batches
SETTLE_SECONDS = 5.0  # grace after the last injected batch for stray replies to land
DEFAULT_LOCK_FILENAME = ".ws_logger.lock"


class NameFetcher:
    """Inject 0x0d/0x001f brief requests through the game socket for unknown ids.

    Frames go out via page JS (window.__wsLoggerWs, captured by WS_SEND_HOOK_JS);
    responses arrive on the normal receive path and are logged by the brief sink.

    bind() must point at the page that OWNS the game socket — window.__wsLoggerWs
    lives in that page's JS context only. A transient popup must never steal the
    binding (seen 2026-10-23: context "page" hook reassigned to a popup, the popup
    closed, and every inject then hit a dead target until the snapshot timeout).

    With enabled=False (--no-fetch-names) queue()/flush() are no-ops: passive mode.
    """

    def __init__(self, enabled: bool = True) -> None:
        self.enabled = enabled
        self.page: Optional[Page] = None
        self.page_closed = False
        self.pending: set[int] = set()
        self.requested: set[int] = set()
        self.last_flush = 0.0
        self.last_attempt = 0.0
        self._lock = asyncio.Lock()

    def bind(self, page: Page) -> None:
        if self.page is page:
            return  # game socket re-opened on the same page (reload) — keep listener state
        self.page = page
        self.page_closed = False
        page.on("close", self._on_page_closed)

    def _on_page_closed(self, _page=None) -> None:
        self.page_closed = True
        if self.pending:
            print(f"[names] game page closed with {len(self.pending)} ids unfetched", flush=True)

    def queue(self, ids) -> None:
        if not self.enabled:
            return
        self.pending.update(i for i in ids if i not in self.requested)

    def settled(self) -> bool:
        """All queued ids sent and enough time passed for the last replies to land."""
        if self.pending:
            return False
        # empty requested == nothing to fetch at all (empty map) — don't wait for grace
        return asyncio.get_running_loop().time() - self.last_flush > SETTLE_SECONDS

    async def flush(self, force: bool = False) -> None:
        if not self.enabled or not self.pending or self.page is None or self.page_closed:
            return
        now = asyncio.get_running_loop().time()
        self.last_attempt = now
        if not force and now - self.last_flush < NAME_FETCH_MIN_INTERVAL:
            return
        async with self._lock:
            if not self.pending:
                return
            while self.pending:
                ids = sorted(self.pending)[:BRIEF_CHUNK]
                try:
                    sent = await self.page.evaluate(SEND_FRAME_JS, list(build_brief_request(ids)))
                except Exception as exc:  # noqa: BLE001 — page closing etc. must not kill the logger
                    print(f"[names] inject failed: {exc}", flush=True)
                    return
                if not sent:
                    print("[names] game socket not ready; will retry on next trigger", flush=True)
                    return
                self.requested.update(ids)
                self.pending.difference_update(ids)
                print(f"[names] requested briefs for {len(ids)} ids", flush=True)
                if self.pending:
                    await asyncio.sleep(0.5)  # pace multi-chunk batches
            self.last_flush = asyncio.get_running_loop().time()


@dataclass
class LoggerContext:
    """Shared per-run handles an event logger's routes can use."""

    page: Page
    name_fetcher: NameFetcher
    brief_sink: JsonlSink
    guild_sink: JsonlSink


@dataclass
class FrameRoutes:
    """Event-specific wiring plugged into the core's websocket + run loop."""

    on_frame: Optional[Callable[[bytes], None]] = None
    on_sent: Optional[Callable[[bytes], None]] = None
    snapshot_done: Optional[Callable[[], Awaitable[bool]]] = None  # --snapshot completion check


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

    async def run(self) -> LoggerContext:
        args = self.args
        profile_dir = pathlib.Path(args.profile)
        if not acquire_profile_lock(profile_dir, self.lock_filename):
            raise SystemExit(1)
        name_fetcher = NameFetcher(enabled=not args.no_fetch_names)
        brief_sink = JsonlSink(args.briefs or args.dir / "player-briefs.jsonl", "brief")
        guild_sink = JsonlSink(args.guilds or args.dir / "guild-briefs.jsonl", "guild")
        stop = asyncio.Event()
        install_stop_signals(stop)

        async with async_playwright() as playwright:
            context = await playwright.chromium.launch_persistent_context(
                user_data_dir=str(profile_dir),
                channel="chrome",
                headless=False,
                viewport={"width": 640, "height": 720},
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--hide-crash-restore-bubble",
                ],
                service_workers="block",
            )
            await context.add_init_script(WS_SEND_HOOK_JS)  # covers pages opened later
            try:
                page = context.pages[0] if context.pages else await context.new_page()

                async def prepare(new_page: Page) -> None:
                    await install_profile_popup_guard(new_page)
                    # page-level init script: context-level ones don't reach the pre-existing
                    # page of a persistent profile (seen 2026-10-23: hook never ran)
                    await new_page.add_init_script(WS_SEND_HOOK_JS)

                page = await navigate_to_game(context, page, args.url, prepare_page=prepare)
                try:
                    await page.evaluate(WS_SEND_HOOK_JS)  # belt & suspenders for the current doc
                except Exception as exc:  # noqa: BLE001 — frame not ready yet; heartbeats retrigger send hook
                    print(f"[names] send-hook evaluate skipped: {exc}", flush=True)
                name_fetcher.bind(page)  # provisional; the game-socket open re-binds authoritatively
                guard_task = asyncio.create_task(install_game_core_frame_guard_after_delay(page))

                ctx = LoggerContext(
                    page=page,
                    name_fetcher=name_fetcher,
                    brief_sink=brief_sink,
                    guild_sink=guild_sink,
                )
                routes = self.routes_factory(ctx)

                def hook(new_page: Page) -> None:
                    # Do NOT rebind name_fetcher here: any popup would steal it and die
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

                hook(page)
                context.on("page", hook)

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
                guard_task.cancel()
            finally:
                await context.close()
                release_profile_lock(profile_dir, self.lock_filename)
        return ctx

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
            ctx.name_fetcher.bind(page)  # injection must target the page owning this socket
        pending_guild_requests: dict[int, int] = {}  # seq -> guild id asked via 0x24/0x0035

        def on_sent(payload) -> None:
            if not isinstance(payload, bytes):
                return
            try:
                header, body = split_frame("S", payload)
            except (IndexError, struct.error):
                return
            if header["module"] == GUILD_MODULE and header["cmd"] == GUILD_BRIEF_CMD:
                for f, _w, v in decode_proto(body):
                    if f == 1 and isinstance(v, bytes):
                        ids = read_packed_varints(v)
                        if ids:
                            pending_guild_requests[header["seq"]] = ids[0]
            elif header["module"] == PLAYER_MODULE and header["cmd"] == PLAYER_BRIEF_CMD:
                # the client fetched names itself — don't re-request those ids
                for f, _w, v in decode_proto(body):
                    if f == 1 and isinstance(v, bytes):
                        client_ids = set(read_packed_varints(v))
                        ctx.name_fetcher.requested.update(client_ids)
                        ctx.name_fetcher.pending.difference_update(client_ids)
            if routes.on_sent is not None:
                routes.on_sent(payload)

        def on_frame(payload) -> None:
            if not isinstance(payload, bytes):
                return
            if frame_is(payload, PLAYER_MODULE, (PLAYER_BRIEF_LIST_CMD,)):
                _header, body = split_frame("R", payload)
                asyncio.ensure_future(ctx.brief_sink.add(parse_player_briefs(body)))
            elif frame_is(payload, GUILD_MODULE, (GUILD_BRIEF_LIST_CMD,)):
                header, body = split_frame("R", payload)
                info = parse_guild_brief(body)
                asyncio.ensure_future(
                    ctx.guild_sink.add(
                        [{**info, "guild_id": pending_guild_requests.pop(header["seq"], None)}]
                    )
                )
            if routes.on_frame is not None:
                routes.on_frame(payload)

        def on_close() -> None:
            if not is_game_socket:
                return
            print("[ws close] game socket dropped; reloading page in 10s...", flush=True)
            asyncio.ensure_future(reload_later(page))

        ws.on("framereceived", on_frame)
        ws.on("framesent", on_sent)
        ws.on("close", on_close)
