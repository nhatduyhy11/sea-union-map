"""Player/guild name service for the live event loggers.

Owns the whole id -> name pipeline: injected 0x0d/0x001f brief requests for
unknown player ids, sniffing the client's own 0x0d/0x001f + 0x24/0x0035
requests, and logging 0x0020 / 0x0036 replies to the brief/guild JSONL sinks.
The runner only forwards websocket frames (on_sent / on_frame) and binds the
game page; event routes queue ids and drive flush().
"""

import asyncio
import struct

from playwright.async_api import Page

from browser.ws_inject import SEND_FRAME_JS
from core.decode import decode_proto, read_packed_varints, split_frame
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
from core.sinks import JsonlSink

BRIEF_CHUNK = 60  # client batches ~59 ids per request
NAME_FETCH_MIN_INTERVAL = 5.0  # seconds between injected batches
SETTLE_SECONDS = 5.0  # grace after the last injected batch for stray replies to land


class NameService:
    """Resolve player/guild ids to names through the game socket.

    Frames go out via page JS (window.__wsLoggerWs, captured by WS_SEND_HOOK_JS);
    responses arrive on the normal receive path and land in brief_sink/guild_sink.

    bind() must point at the page that OWNS the game socket — window.__wsLoggerWs
    lives in that page's JS context only. A transient popup must never steal the
    binding (seen 2026-10-23: context "page" hook reassigned to a popup, the popup
    closed, and every inject then hit a dead target until the snapshot timeout).

    With enabled=False (--no-fetch-names) queue()/flush() are no-ops: passive mode
    (replies to the client's own requests are still logged).
    """

    def __init__(self, brief_sink: JsonlSink, guild_sink: JsonlSink, *, enabled: bool = True) -> None:
        self.brief_sink = brief_sink
        self.guild_sink = guild_sink
        self.enabled = enabled
        self.page: Page | None = None
        self.page_closed = False
        self.pending: set[int] = set()
        self.requested: set[int] = set()
        self.last_flush = 0.0
        self.last_attempt = 0.0
        self._lock = asyncio.Lock()
        self._guild_requests: dict[int, int] = {}  # seq -> guild id asked via 0x24/0x0035

    def bind(self, page: Page) -> None:
        # seqs are per socket — a new game socket (even on the same page) starts fresh
        self._guild_requests.clear()
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

    def mark_requested(self, ids) -> None:
        """Ids someone else (the client) already asked for — never re-request them."""
        self.requested.update(ids)
        self.pending.difference_update(ids)

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
                self.mark_requested(ids)
                print(f"[names] requested briefs for {len(ids)} ids", flush=True)
                if self.pending:
                    await asyncio.sleep(0.5)  # pace multi-chunk batches
            self.last_flush = asyncio.get_running_loop().time()

    def on_sent(self, payload: bytes) -> None:
        """Sniff the client's own brief requests (guild seq map, player id dedupe)."""
        try:
            header, body = split_frame("S", payload)
        except (IndexError, struct.error):
            return
        if header["module"] == GUILD_MODULE and header["cmd"] == GUILD_BRIEF_CMD:
            for f, _w, v in decode_proto(body):
                if f == 1 and isinstance(v, bytes):
                    ids = read_packed_varints(v)
                    if ids:
                        self._guild_requests[header["seq"]] = ids[0]
        elif header["module"] == PLAYER_MODULE and header["cmd"] == PLAYER_BRIEF_CMD:
            # the client fetched names itself — don't re-request those ids
            for f, _w, v in decode_proto(body):
                if f == 1 and isinstance(v, bytes):
                    self.mark_requested(set(read_packed_varints(v)))

    def on_frame(self, payload: bytes) -> None:
        """Log player (0x0020) and guild (0x0036) brief replies to their sinks."""
        if frame_is(payload, PLAYER_MODULE, (PLAYER_BRIEF_LIST_CMD,)):
            _header, body = split_frame("R", payload)
            asyncio.ensure_future(self.brief_sink.add(parse_player_briefs(body)))
        elif frame_is(payload, GUILD_MODULE, (GUILD_BRIEF_LIST_CMD,)):
            header, body = split_frame("R", payload)
            info = parse_guild_brief(body)
            asyncio.ensure_future(
                self.guild_sink.add([{**info, "guild_id": self._guild_requests.pop(header["seq"], None)}])
            )
