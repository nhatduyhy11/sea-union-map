"""Route WS frames for the crawler and correlate injected requests by ssid.

Injected requests use ssid bytes 0xF0..0xFF (core.protocol.INJECT_SEQ
convention): the server echoes the ssid in the response header, the game client
ignores stray replies, so responses correlate by ssid.
"""

import asyncio
from collections.abc import Callable

from playwright.async_api import Page, WebSocket

from browser.ws_inject import SEND_FRAME_JS
from capture.frames import FrameWriter
from core.decode import decode_proto
from core.protocol import parse_player_briefs
from sea_socket.protocol import (
    LOGIN_DONE_CMD,
    MAP_SNAPSHOT_CMD,
    PLAYER_MODULE,
    SEA_MODULE,
    build_request,
    iter_frames,
    parse_map_snapshot,
)

INJECT_TIMEOUT = 8.0
REQUEST_PACE = 0.4  # seconds between injected requests
# Server throttles bursts of injected requests with err 10000035 (2026-10-26:
# ~57 requests pass, then blocks of ~5 rejections arrive at a duty cycle; the
# rejected set differs run to run while owners don't — quota, not node state).
# Anomalous responses get retried with backoff; a state answer without an f2
# node blob and a compressed board body under 24B are both throttle rejections.
THROTTLE_RETRY_ATTEMPTS = 5


class CrawlRouter:
    """Route WS frames: resolve pending injected requests + keep named datasets."""

    def __init__(self, writer: FrameWriter) -> None:
        self.writer = writer
        self.pending: dict[int, asyncio.Future] = {}
        self.seq = 0xF0  # INJECT_SEQ convention: game client ignores these replies
        self.map_snapshot: dict | None = None
        self.login_done_ms: int | None = None  # writer ms of first R 0x72/0x0002
        self.briefs: dict[str, dict] = {}
        self.node_states: dict[int, dict] = {}
        self.board_bodies: dict[tuple[int, int], tuple[bytes, bool]] = {}

    def next_seq(self) -> int:
        self.seq = self.seq % 0xFF + 1  # 0xF1..0xFF, then 0x01.. — never 0x00
        return self.seq

    async def send(self, page: Page, make_frame: Callable[[int], bytes],
                   label: str) -> tuple[dict, bytes]:
        """Send make_frame(seq) on the game socket, await the ssid-matched reply."""
        seq = self.next_seq()
        fut: asyncio.Future = asyncio.get_running_loop().create_future()
        self.pending[seq] = fut
        await self.writer.mark(f"inject:{label}")
        sent = await page.evaluate(SEND_FRAME_JS, list(make_frame(seq)))
        if not sent:
            self.pending.pop(seq, None)
            raise RuntimeError("game socket not ready for injection")
        try:
            return await asyncio.wait_for(fut, INJECT_TIMEOUT)
        except asyncio.TimeoutError:
            self.pending.pop(seq, None)
            raise RuntimeError(
                f"no response to {label} seq={seq:#x} within {INJECT_TIMEOUT}s"
            ) from None

    async def inject(self, page: Page, module: int, cmd: int,
                     fields: list[tuple[int, int]]) -> tuple[dict, bytes]:
        return await self.send(
            page, lambda seq: build_request(module, cmd, seq, fields),
            f"{module:02x}/{cmd:04x}:{fields}")

    def route(self, direction: str, payload) -> None:
        if direction != "R" or not isinstance(payload, bytes):
            return
        try:
            for header, body in iter_frames("R", payload):
                fut = self.pending.pop(header["seq"], None)
                if fut is not None and not fut.done():
                    fut.set_result((header, body))
                module, cmd = header["module"], header["cmd"]
                if module == SEA_MODULE and cmd == MAP_SNAPSHOT_CMD and self.map_snapshot is None:
                    self.map_snapshot = parse_map_snapshot(body)
                elif module == SEA_MODULE and cmd == LOGIN_DONE_CMD and self.login_done_ms is None:
                    self.login_done_ms = self.writer.elapsed_ms()
                    print(f"[login] R 0x72/0x0002 at +{self.login_done_ms}ms", flush=True)
                elif module == PLAYER_MODULE and cmd == 0x0020:
                    for brief in parse_player_briefs(body):
                        if brief.get("id") is not None:
                            self.briefs[str(brief["id"])] = brief
        except Exception as exc:  # noqa: BLE001 — a router bug must never kill the session
            print(f"[route] frame handling failed: {exc}", flush=True)

    def attach(self, ws: WebSocket, ws_url: str) -> None:
        ws.on("framereceived", lambda payload: (
            self.route("R", payload),
            asyncio.ensure_future(self.writer.write_frame("R", ws_url, payload)),
        ))
        ws.on("framesent", lambda payload: asyncio.ensure_future(
            self.writer.write_frame("S", ws_url, payload)))


def state_throttled(_header: dict, body: bytes) -> bool:
    return not any(field == 2 for field, _w, _v in decode_proto(body))


def board_throttled(_header: dict, body: bytes) -> bool:
    return len(body) < 24  # err body: 12B compressed; real boards ≥ 32B


async def inject_retrying(page: Page, router: CrawlRouter, module: int, cmd: int,
                          fields: list[tuple[int, int]], is_anomalous) -> tuple[dict, bytes, int]:
    """inject() with throttle backoff; returns (header, body, retries_used)."""
    retries = 0
    header, body = await router.inject(page, module, cmd, fields)
    while is_anomalous(header, body) and retries < THROTTLE_RETRY_ATTEMPTS:
        wait = min(2 ** retries, 10.0)
        retries += 1
        print(f"[throttle] {module:02x}/{cmd:04x} {fields} — retry {retries} in {wait:.0f}s",
              flush=True)
        await asyncio.sleep(wait)
        header, body = await router.inject(page, module, cmd, fields)
    return header, body, retries
