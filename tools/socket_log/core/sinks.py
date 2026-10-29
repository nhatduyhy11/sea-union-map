"""JSONL output sink shared by the core runner and the event loggers."""

import datetime
import json
import pathlib


class JsonlSink:
    """Append dicts as JSONL lines; every push is new data (no dedupe)."""

    def __init__(self, out_path: pathlib.Path, tag: str) -> None:
        self.out_path = out_path
        self.tag = tag
        self.count = 0
        out_path.parent.mkdir(parents=True, exist_ok=True)

    async def add(self, rows: list[dict]) -> None:
        if not rows:
            return
        logged_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        with self.out_path.open("a", encoding="utf-8") as fh:
            for row in rows:
                fh.write(json.dumps({**row, "logged_at": logged_at}, ensure_ascii=False) + "\n")
        self.count += len(rows)
        print(f"[{self.tag}] {len(rows)} rows (total {self.count})", flush=True)
