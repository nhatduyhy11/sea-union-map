"""Mine-specific JSONL sinks: the deduplicating broadcast-event sink."""

import asyncio
import datetime
import json
import pathlib
from typing import Optional


class MineEventSink:
    """Dedupe by event id, append fresh events to JSONL, optional webhook."""

    def __init__(self, out_path: pathlib.Path, webhook: Optional[str]) -> None:
        self.out_path = out_path
        self.webhook = webhook
        self.seen_ids: set[int] = set()
        self.new_count = 0
        out_path.parent.mkdir(parents=True, exist_ok=True)
        if out_path.exists():
            for line in out_path.read_text(encoding="utf-8").splitlines():
                try:
                    self.seen_ids.add(json.loads(line)["id"])
                except (json.JSONDecodeError, KeyError):
                    continue
        print(f"[sink] {len(self.seen_ids)} known events from {out_path}", flush=True)

    async def add(self, events: list[dict]) -> None:
        fresh = [e for e in events if e["id"] not in self.seen_ids]
        if not fresh:
            return
        with self.out_path.open("a", encoding="utf-8") as fh:
            for event in fresh:
                self.seen_ids.add(event["id"])
                fh.write(json.dumps(event, ensure_ascii=False) + "\n")
        self.new_count += len(fresh)
        for event in fresh:
            print(
                f"[mine] #{event['id']} {event['time'][11:19]}Z "
                f"{event['player']} pos={event['pos']} action={event['action']}",
                flush=True,
            )
        if self.webhook:
            await self._post(fresh)

    async def _post(self, events: list[dict]) -> None:
        import urllib.request

        def post() -> None:
            request = urllib.request.Request(
                self.webhook,
                data=json.dumps(events, ensure_ascii=False).encode(),
                headers={"Content-Type": "application/json"},
            )
            urllib.request.urlopen(request, timeout=5)

        try:
            await asyncio.to_thread(post)
        except OSError as exc:
            print(f"[webhook] failed: {exc}")
