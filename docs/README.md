# burrito-socket-capture

Nhánh nghiên cứu **websocket-only**: bắt và giải mã packet WS của game H5
(Haunted Room / Haunt Heroes). Toàn bộ logic bot vision cũ (automap, train,
night, hero select, runner…) đã bị xoá khỏi nhánh này — lịch sử vẫn còn trên
`master`.

## Tools (`tools/socket_log/`)

Tầng dùng chung (reused bởi mọi event logger):

| File                | Vai trò                                                                                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `socket_capture.py` | POC bắt frame: hook mọi WebSocket, dump payload nguyên vẹn ra `frames/NNNNN-{S\|R}.bin` + `index.jsonl`, kèm step DSL (`click:X,Y`, `shot:NAME`, `sleep:S`, `mark:LABEL`)  |
| `socket_decode.py`  | Decoder wire-format generic (không cần schema `.proto`), annotate timestamp heuristic                                                                                      |
| `game_protocol.py`  | Protocol tầng game dùng chung: broadcast bus (0x13), player/guild brief (0x0d/0x24), `frame_is`, `build_brief_request`                                                     |
| `ws_logger.py`      | Core runner dùng chung: session Chrome persistent, hook WS, sink JSONL, fetch tên người chơi qua injected request, các chế độ chạy (forever / `--duration` / `--snapshot`) |
| `logger_args.py`    | CLI args dùng chung của logger (`--profile/--url/--dir/--snapshot/--duration/...`)                                                                                         |
| `process_guard.py`  | Lock theo profile (chặn chạy 2 instance) + xử lý stop signals                                                                                                              |
| `page_guards.py`    | Chặn popup profile, ẩn iframe H5 SDK (inlined từ bot cũ)                                                                                                                   |
| `navigation.py`     | `navigate_to_game` có retry qua transient hang (inlined từ bot cũ)                                                                                                         |

Từng event riêng (thư mục con, hiện chỉ có mine):

| File                      | Vai trò                                                                 |
| ------------------------- | ----------------------------------------------------------------------- |
| `mine_logger.py`          | Entry point event mine: tạo sink + route mine, lắp vào core `ws_logger` |
| `mine_socket/protocol.py` | Module 0x48 + broadcast type 150 (parse event/tile)                     |
| `mine_socket/sinks.py`    | `MineEventSink` — dedupe theo event id, optional webhook                |
| `mine_socket/handlers.py` | Route frame mine vào sink + predicate hoàn thành `--snapshot`           |
| `mine_socket/report.py`   | Aggregate các JSONL thành mine-report.json + cây báo cáo                |
| `mine_socket/decode.py`   | Decoder offline `mine-events`/`mine-state` trên capture dir             |

## Usage

```bash
# Bắt frame thô (POC)
uv run python tools/socket_log/socket_capture.py --profile .tmp/pmain --settle 12 --step shot:home

# Logger dài hạn
uv run python tools/socket_log/mine_logger.py --profile .tmp/pmain --snapshot        # 1 pass state + tên, rồi thoát
uv run python tools/socket_log/mine_logger.py --profile .tmp/pmain --duration 300    # tự dừng sau 5 phút

# Báo cáo từ JSONL đã ghi
uv run python tools/socket_log/mine_socket/report.py                                # --dir .tmp/mine-events
```

Cần profile `.tmp/<name>` đã có session đăng nhập (persistent context của
Playwright). Raw streams ghi dưới `.tmp/mine-events/`.

## Docs

- [`SOCKET_PROTOCOL.md`](SOCKET_PROTOCOL.md) — reference protocol WS (framing, module/cmd, decode)
- [`MINE_STRUCTURE.md`](MINE_STRUCTURE.md) — cấu trúc world mỏ: map UI ↔ protocol
- `planning/` — research notes còn tồn động (socket research, leaderboard WS, conventions)
- `assets/` — ảnh in-game dùng đối chiếu protocol
