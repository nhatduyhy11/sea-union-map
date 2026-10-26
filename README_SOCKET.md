# burrito-socket-capture

Nhánh nghiên cứu **websocket-only**: bắt và giải mã packet WS của game H5
(Haunted Room / Haunt Heroes). Toàn bộ logic bot vision cũ (automap, train,
night, hero select, runner…) đã bị xoá khỏi nhánh này — lịch sử vẫn còn trên
`master`.

## Tools (`tools/socket_log/`)

Có **2 mode** dùng chung một tầng core WS — chọn mode theo entry point:

- **Mode mine** — event world mỏ (module 0x48 + broadcast type 150)
- **Mode sea** — Tranh Bá Tứ Hải (module 0x72 + board 0x0c), kèm pipeline crawl → JSON cho FE

### Dùng chung

| File                | Vai trò                                                                                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ws_logger.py`      | Core runner: session Chrome persistent, hook WS, sink JSONL, fetch tên người chơi qua injected request, các chế độ chạy (forever / `--duration` / `--snapshot`)            |
| `socket_capture.py` | POC bắt frame thô: dump payload nguyên vẹn ra `frames/NNNNN-{S\|R}.bin` + `index.jsonl`, kèm step DSL (`click:X,Y`, `shot:NAME`, `sleep:S`, `mark:LABEL`)                   |
| `socket_decode.py`  | Decoder wire-format generic (không cần schema `.proto`), annotate timestamp heuristic                                                                                      |
| `game_protocol.py`  | Protocol tầng game dùng chung: broadcast bus (0x13), player/guild brief (0x0d/0x24), `frame_is`, `build_brief_request`, convention inject ssid `0xF0..0xFF`                 |
| `logger_args.py`    | CLI args dùng chung của logger (`--profile/--url/--dir/--snapshot/--duration/...`)                                                                                         |
| `process_guard.py`  | Lock theo profile (chặn chạy 2 instance) + xử lý stop signals                                                                                                              |
| `page_guards.py`    | Chặn popup profile, ẩn iframe H5 SDK (inlined từ bot cũ)                                                                                                                   |
| `navigation.py`     | `navigate_to_game` có retry qua transient hang (inlined từ bot cũ)                                                                                                         |

### Mode 1 — mine

| File                      | Vai trò                                                                 |
| ------------------------- | ----------------------------------------------------------------------- |
| `mine_logger.py`          | Entry point event mine: tạo sink + route mine, lắp vào core `ws_logger` |
| `mine_socket/protocol.py` | Module 0x48 + broadcast type 150 (parse event/tile)                     |
| `mine_socket/sinks.py`    | `MineEventSink` — dedupe theo event id, optional webhook                |
| `mine_socket/handlers.py` | Route frame mine vào sink + predicate hoàn thành `--snapshot`           |
| `mine_socket/report.py`   | Aggregate các JSONL thành mine-report.json + cây báo cáo                |
| `mine_socket/decode.py`   | Decoder offline `mine-events`/`mine-state` trên capture dir binary      |

Logger ghi thẳng **JSONL đã decode** (không phải binary): `mine-events.jsonl`,
`player-briefs.jsonl`, `guild-briefs.jsonl` dưới `.tmp/mine-events/`.

```bash
# Snapshot nhanh: 1 pass state + tên, rồi thoát
uv run python tools/socket_log/mine_logger.py --profile .tmp/pmain --snapshot

# Logger dài hạn, tự dừng sau 5 phút
uv run python tools/socket_log/mine_logger.py --profile .tmp/pmain --duration 300

# Báo cáo từ JSONL đã ghi (mặc định --dir .tmp/mine-events)
uv run python tools/socket_log/mine_socket/report.py

# Decode offline từ capture binary của socket_capture.py
uv run python tools/socket_log/mine_socket/decode.py .tmp/socket-capture/run-mine1 mine-events
```

### Mode 2 — sea

Pipeline chuẩn: crawl → bóc config → dump JSON cho FE
(xem `docs/DATA_PIPELINE.md`).

| File                    | Vai trò                                                                                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sea_capture.py`        | Walkthrough GUI: stage DSL login → lobby → battle map → node detail/boss/board, chụp bằng chứng từng bước (chỉ để proof protocol)                                            |
| `sea_crawler.py`        | **Collector chính**: mở map 1 lần lấy snapshot 89 node, rồi inject `0x72/0x0011` + board `0x0c/0x0002` theo id — không đụng UI; decode board bằng runtime game                |
| `sea_config_extract.py` | Bóc bảng config client (CampGVG…) headless **không cần login**: boot page game, dump `window.__require(<TABLE>).store` ra JSON                                                |
| `sea_to_ui.py`          | Dump crawl JSONL + CampGVG thành JSON thuần cho FE (mặc định `public/sea-live-dev.json` gitignored; `--out src/data/sea-live.json` để bake vào build); lệch số ở `docs/STATS_MISMATCH.md` |
| `game_proto_decode.py`  | Decode frame nén/không schema qua runtime game headless (`window.__require`): QuickLZ + BufferUtils; mode `rank` (0x0c/0x0003) / `briefs` (0x0d/0x0020), `--cut` tách body     |

```bash
# [1] Crawl đủ 89 node (headed mặc định, cần session đăng nhập)
uv run python tools/socket_log/sea_crawler.py --profile .tmp/pmain
#    → .tmp/sea-crawl/<run>/: map-snapshot.json, node-states.jsonl,
#      boards-decoded.json, players.jsonl, summary.json

# [2] Bóc config CampGVG (không cần login) — chỉ chạy 1 LẦN rồi reuse:
#    campgvglo.json để nguyên trên đĩa, các lần crawl sau không cần bước này.
#    Chỉ chạy lại khi game deploy bundle mới mà config đổi (season mới, sửa node).
uv run python tools/socket_log/sea_config_extract.py --table CampGVGLO \
    --out .tmp/sea-crawl/campgvglo.json

# [3] Dump JSON cho FE (dev: public/sea-live-dev.json, gitignored)
uv run python tools/socket_log/sea_to_ui.py --crawl .tmp/sea-crawl/<run> \
    --config .tmp/sea-crawl/campgvglo.json
#    Bake chính thức vào build:
uv run python tools/socket_log/sea_to_ui.py --crawl .tmp/sea-crawl/<run> \
    --config .tmp/sea-crawl/campgvglo.json --out src/data/sea-live.json
```

Helper decode offline (nếu cần tách riêng 1 frame board từ capture):

```bash
uv run python tools/socket_log/game_proto_decode.py rank body.b64
```

## Prerequisite

Mode mine và sea crawler đều cần profile `.tmp/<name>` đã có session đăng nhập
(persistent context của Playwright). Riêng `sea_config_extract.py` boot headless
không cần login.

## Docs

- [`docs/SOCKET_PROTOCOL.md`](docs/SOCKET_PROTOCOL.md) — reference protocol WS (framing, module/cmd, decode)
- [`docs/MINE_STRUCTURE.md`](docs/MINE_STRUCTURE.md) — cấu trúc world mỏ: map UI ↔ protocol
- [`docs/SEA_STRUCTURE.md`](docs/SEA_STRUCTURE.md) — cấu trúc event Tranh Bá Tứ Hải: map UI ↔ protocol
- [`docs/DATA_PIPELINE.md`](docs/DATA_PIPELINE.md) — luồng crawl → UI, issue format dump `.ts` vs JSON tĩnh
- [`docs/STATS_MISMATCH.md`](docs/STATS_MISMATCH.md) — các lệch số UI vs game đã biết (backlog handoff)
- `docs/planning/` — research notes còn tồn động (socket research, leaderboard WS, conventions)
- `docs/assets/` — ảnh in-game dùng đối chiếu protocol
- [`BACKLOG.md`](BACKLOG.md) — các việc đã nhận biết chưa làm (crawler entry flaky, watermark background, guild id, thứ tự tab, BXH Phe sort theo lực chiến, node trung lập mờ sẵn…)
