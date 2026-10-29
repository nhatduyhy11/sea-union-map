"""Raw WebSocket frame recorder: every payload verbatim (binary included) under
frames/ plus an index.jsonl for later correlation. Shared by the capture CLI,
the sea walkthrough, the crawler and brief_backfill."""

import asyncio
import json
import time
from pathlib import Path
from typing import Union

from playwright.async_api import Page

DEFAULT_OUT_DIR = Path(".tmp/socket-capture")


class FrameWriter:
    """Persist every WebSocket payload plus an index for later correlation."""

    def __init__(self, out_dir: Path) -> None:
        self.out_dir = out_dir
        self.frames_dir = out_dir / "frames"
        self.frames_dir.mkdir(parents=True, exist_ok=True)
        self.index_path = out_dir / "index.jsonl"
        self.seq = 0
        self.started = time.monotonic()
        self._lock = asyncio.Lock()

    async def _append(self, record: dict) -> None:
        line = json.dumps(record, ensure_ascii=False)
        async with self._lock:
            with self.index_path.open("a", encoding="utf-8") as fh:
                fh.write(line + "\n")

    def elapsed_ms(self) -> int:
        return int((time.monotonic() - self.started) * 1000)

    async def mark(self, label: str) -> None:
        await self._append(
            {"n": None, "t": self.elapsed_ms(), "dir": "M", "label": label}
        )
        print(f"[mark] {label} @ {self.elapsed_ms()}ms")

    async def ws_open(self, ws_url: str) -> None:
        await self._append({"n": None, "t": self.elapsed_ms(), "dir": "O", "ws": ws_url})

    async def write_frame(self, direction: str, ws_url: str, payload: Union[str, bytes]) -> None:
        self.seq += 1
        seq = self.seq
        if isinstance(payload, str):
            raw = payload.encode("utf-8")
            suffix = ".txt"
        else:
            raw = payload
            suffix = ".bin"
        name = f"{seq:05d}-{direction}{suffix}"
        (self.frames_dir / name).write_bytes(raw)
        await self._append(
            {
                "n": seq,
                "t": self.elapsed_ms(),
                "dir": direction,
                "ws": ws_url,
                "size": len(raw),
                "file": f"frames/{name}",
            }
        )
        preview = raw[:48].hex() if suffix == ".bin" else raw[:48].decode("utf-8", "replace")
        print(f"[ws {direction}] #{seq} {len(raw)}B {preview}")


def attach_capture(page: Page, writer: FrameWriter) -> None:
    def on_websocket(ws) -> None:
        print(f"[ws open] {ws.url}")
        asyncio.ensure_future(writer.ws_open(ws.url))
        ws.on("framesent", lambda payload: asyncio.ensure_future(writer.write_frame("S", ws.url, payload)))
        ws.on(
            "framereceived",
            lambda payload: asyncio.ensure_future(writer.write_frame("R", ws.url, payload)),
        )

    page.on("websocket", on_websocket)
