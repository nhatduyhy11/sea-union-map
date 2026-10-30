# Sea Union

Web UI (React Flow) xem map **Tranh Bá Tứ Hải** theo data crawl, và crawler
Python bắt/giải mã packet websocket của game H5. Repo gồm hai nửa nối nhau bằng
pipeline crawl → JSON → UI:

- `tools/socket_log/` — crawler & decoder WS, 2 mode: **mine** (Khai Thác
  Guild) và **sea** (Tranh Bá Tứ Hải)
- `src/` — web UI React + React Flow, chạy hoàn toàn phía trình duyệt

## Web UI

Giao diện Web tương tác xem bản đồ và bảng xếp hạng sự kiện Tranh Bá Tứ Hải, xây dựng bằng **React 19**, **Vite** và **React Flow**.

👉 **Tài liệu chi tiết dành riêng cho Frontend:** xem [`README.md`](README.md) (hướng dẫn tương tác chi tiết, cấu trúc bố cục 89 node, kiến trúc `src/` và state management Zustand).

### Chạy nhanh Frontend

```sh
pnpm install
pnpm run dev
```

Mở URL local do Vite in ra (mặc định `http://localhost:5173`). `pnpm run build` tạo bản static trong `dist/`; `pnpm test` chạy toàn bộ kiểm thử đơn vị.

## Crawler (`tools/socket_log/`)

Có **2 mode** dùng chung một tầng generic — chọn mode theo entry point:

- **Mode sea** — Tranh Bá Tứ Hải (module 0x72 + board 0x0c), kèm pipeline crawl → JSON cho FE
- **Mode mine** — event world mỏ (module 0x48 + broadcast type 150)

Layout: 4 package generic (`core/`, `browser/`, `capture/`, `gui/`) + 2 package event
(`sea_socket/`, `mine_socket/`) độc lập nhau — xóa 1 package event thì package
kia vẫn chạy bình thường; `config_extract.py` đứng top-level vì không đụng socket.

### Dùng chung

| File                       | Vai trò                                                                                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/runner.py`           | Core runner: session Chrome persistent, hook WS (chuyển frame cho `NameService` + route event), các chế độ chạy (forever / `--duration` / `--snapshot`)            |
| `core/names.py`            | `NameService`: resolve id → tên player/guild — inject `0x0d/0x001f` theo lô 60 id, sniff request brief của chính client, ghi reply `0x0020`/`0x0036` ra `player-briefs.jsonl` / `guild-briefs.jsonl` |
| `core/sinks.py`            | `JsonlSink`: append row JSONL (kèm `logged_at`) — dùng chung cho runner và sink riêng của event logger |
| `browser/ws_inject.py`     | JS hook `WS_SEND_HOOK_JS` (bắt instance WebSocket game) + `SEND_FRAME_JS` (inject frame) — dùng bởi `NameService`, crawler, brief_backfill |
| `capture/frames.py`        | `FrameWriter` + `attach_capture`: dump payload WS nguyên vẹn ra `frames/NNNNN-{S\|R}.bin` + `index.jsonl` — dùng chung cho capture CLI, walkthrough, crawler, brief_backfill |
| `capture/capture.py`       | CLI bắt frame thô + chạy step DSL (`--step click:X,Y ...`) — tool research/debug protocol (POC decode flow mới), **không thuộc pipeline dump JSON cho FE**: "chạy capture" hàng ngày là `crawler.py` |
| `gui/steps.py`             | Step DSL vision-action: `sleep/shot/click/scroll/expect/seek/popclose/mark` (dispatch table `STEPS`) — chỉ tool đi bằng click (capture CLI, walkthrough, crawler `--gui-entry` qua walkthrough) mới cần `gui/` |
| `gui/vision.py`            | Template matching thang xám trên screenshot: `resolve_golden` (`gui/goldens/` rồi `docs/assets/sea-socket/`), `screen_similarity`, `best_crop_position` |
| `gui/popclose.py`          | Verb `popclose`: đóng hàng đợi splash popup lúc login (checkbox "không nhắc lại" / nút X / click ngoài) + hằng calibration `POPUP_*` |
| `core/decode.py`           | Decoder wire-format generic (không cần schema `.proto`), annotate timestamp heuristic                                                                                      |
| `core/protocol.py`         | Protocol tầng game dùng chung: broadcast bus (0x13), player/guild brief (0x0d/0x24), `frame_is`, `build_brief_request`, convention inject ssid `0xF0..0xFF`                |
| `core/args.py`             | CLI args dùng chung của logger (`--profile/--url/--dir/--snapshot/--duration/...`)                                                                                         |
| `core/runtime_codec.py`    | Decode frame nén/không schema qua runtime game headless (`window.__require`): QuickLZ + BufferUtils; mode `rank` (0x0c/0x0003) / `briefs` (0x0d/0x0020), `--cut` tách body |
| `browser/process_guard.py` | Lock theo profile (chặn chạy 2 instance) + xử lý stop signals                                                                                                              |
| `browser/page_guards.py`   | Chặn popup profile, ẩn iframe H5 SDK (inlined từ bot cũ)                                                                                                                   |
| `browser/navigation.py`    | `navigate_to_game` có retry qua transient hang (inlined từ bot cũ)                                                                                                         |
| `browser/session.py`       | `launch_session` / `close_session`: mở persistent profile, gắn capture WS cho mọi page, cài page guards                                                                   |

### Mode 1 — sea (`sea_socket/`)

Pipeline chuẩn 4 bước — **crawl → extract → transform → dump**:

- **crawl** — chạy game, bắt/giải mã packet WS thành raw run (JSONL) dưới `.tmp/sea-crawl/<run>/`
- **extract** — bóc bảng config client (CampGVG…) ra khỏi bundle game; cache BE nội bộ, hiếm khi chạy — xem mục **Cache config CampGVG** bên dưới
- **transform** — join raw run + config baseline, chạy cross-checks bắt join hỏng (`report.py`)
- **dump** — ghi kết quả transform ra JSON cho FE (`public/sea-live-dev.json` hoặc `src/data/sea-live.json`)

Luồng đầy đủ tới UI xem mục **Luồng crawl → UI** bên dưới.

| File                        | Vai trò                                                                                                                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sea_socket/walkthrough.py` | Walkthrough GUI: stage DSL login → lobby → battle map → node detail/boss/board, chụp bằng chứng từng bước (proof protocol + fallback `--gui-entry` của crawler)                           |
| `sea_socket/crawler.py`     | **Collector chính**: entry payload mặc định — wait-login `0x72/0x0002` + inject `0x000b`/`0x001b`, 0 click (xem [`docs/sea/EVENT_NAVIGATE_DECODE.md`](docs/sea/EVENT_NAVIGATE_DECODE.md); `--gui-entry` replay stage cũ); vào map xong inject `0x72/0x0011` + board `0x0c/0x0002` theo id — không đụng UI; decode board bằng runtime game; `--dump` (mặc định bật) tự transform + dump ngay sau crawl |
| `sea_socket/protocol.py`    | Module 0x72 + rank 0x0c: frame builder, parse snapshot/node state (pure, testable)                                                                                                        |
| `sea_socket/report.py`      | Transform + dump JSON thuần cho FE (mặc định `public/sea-live-dev.json` gitignored; `--out src/data/sea-live.json` để bake vào build; `--snapshot [--server N]` ghi snapshot lịch sử `src/data/snapshots/<YYMMDD>/<server>.json`) — CLI re-dump độc lập, dùng chung hàm `dump_run` với crawler |
| `config_extract.py`         | Bóc bảng config client (CampGVG…) headless **không cần login**: boot page game, dump `window.__require(<TABLE>).store` ra JSON — hiếm khi chạy, xem mục "Cache config CampGVG"             |

```bash
# [1] Crawl đủ 89 node + dump JSON cho FE trong 1 lệnh (--dump mặc định bật,
#     headed, cần session đăng nhập)
uv run python tools/socket_log/sea_socket/crawler.py --profile .tmp/p545
#    → .tmp/sea-crawl/<run>/: map-snapshot.json, standings.json, node-states.jsonl,
#      boards-decoded.json, players.jsonl, summary.json
#    → public/sea-live-dev.json (transform từ baseline, refresh browser là thấy)
#    --no-dump: chỉ lấy raw run

# [2] Re-dump run cũ / bake chính thức (report.py là CLI riêng)
uv run python tools/socket_log/sea_socket/report.py --crawl .tmp/sea-crawl/<run>
#    Bake snapshot chính thức vào build:
uv run python tools/socket_log/sea_socket/report.py --crawl .tmp/sea-crawl/<run> \
    --out src/data/sea-live.json
#    Snapshot lịch sử theo ngày event × cụm (--server mặc định 517, tạm thời):
uv run python tools/socket_log/sea_socket/report.py --crawl .tmp/sea-crawl/<run> \
    --snapshot [--server 590]
#    → src/data/snapshots/<YYMMDD>/<server>.json — rule quy ngày ở
#      docs/sea/SEA_LIVE_DATA.md
```

### Cache config CampGVG (`sea_socket/campgvg.json`) — BE nội bộ, hiếm khi đụng

`tools/socket_log/sea_socket/campgvg.json` là cache/baseline của riêng tầng
crawler (FE không biết file này tồn tại — data tới FE chỉ qua key `camp` trong
JSON dump). Transform đọc nó tự động; **không có bước nào trong pipeline tự
extract** — cả `crawler.py` lẫn `walkthrough.py` đều không đụng đến, thiếu file
thì dump fail ngay với lệnh cần chạy. Chỉ phải extract lại khi nghi config đổi
phía game (deploy bundle mới, season mới, sửa node):

```bash
uv run python tools/socket_log/config_extract.py --table CampGVGLO \
    --out .tmp/sea-crawl/campgvglo.json
# trùng campgvg.json hiện có → xóa file .tmp, không phải làm gì thêm
# lệch → đối chiếu, cập nhật campgvg.json và commit lại (drift-detection)
```

Extract boot page game headless (cần mạng, không cần login, ~1-2 phút) — vì
vậy nó đứng ngoài luồng crawl thường ngày. Baseline committed cũng là bản ghi
lịch sử config theo git, so drift chỉ là `git diff`.

Helper decode offline (nếu cần tách riêng 1 frame board từ capture):

```bash
uv run python tools/socket_log/core/runtime_codec.py rank body.b64
```

### Mode 2 — mine (`mine_socket/`)

| File                      | Vai trò                                                                      |
| ------------------------- | ---------------------------------------------------------------------------- |
| `mine_socket/logger.py`   | Entry point event mine: tạo sink + route mine, lắp vào core `core/runner.py` |
| `mine_socket/protocol.py` | Module 0x48 + broadcast type 150 (parse event/tile)                          |
| `mine_socket/sinks.py`    | `MineEventSink` — dedupe theo event id, optional webhook                     |
| `mine_socket/handlers.py` | Route frame mine vào sink + predicate hoàn thành `--snapshot`                |
| `mine_socket/report.py`   | Aggregate các JSONL thành mine-report.json + cây báo cáo                     |
| `mine_socket/decode.py`   | Decoder offline `mine-events`/`mine-state` trên capture dir binary           |

Logger ghi thẳng **JSONL đã decode** (không phải binary) dưới `.tmp/mine-events/` —
chi tiết 5 stream xem [`docs/mine_docs/MINE_STRUCTURE.md` §6](docs/mine_docs/MINE_STRUCTURE.md).

```bash
# Snapshot nhanh: 1 pass state + tên, rồi thoát
uv run python tools/socket_log/mine_socket/logger.py --profile .tmp/p545 --snapshot

# Logger dài hạn, tự dừng sau 5 phút
uv run python tools/socket_log/mine_socket/logger.py --profile .tmp/p545 --duration 300

# Báo cáo từ JSONL đã ghi (mặc định --dir .tmp/mine-events)
uv run python tools/socket_log/mine_socket/report.py

# Decode offline từ capture binary của capture/capture.py
uv run python tools/socket_log/mine_socket/decode.py .tmp/socket-capture/<run> mine-events
```

### Prerequisite

Cả hai mode đều cần profile `.tmp/<name>` đã có session đăng nhập (persistent
context của Playwright). Riêng `config_extract.py` boot headless không cần
login.

## Luồng crawl → UI

```
[1] crawl:    sea_socket/crawler.py ──crawl WS game──▶ .tmp/sea-crawl/<run>/ (JSONL + boards-decoded.json)
              └─ --dump (mặc định bật) ──transform + dump──▶ public/sea-live-dev.json (xem trước ở dev)
[2] extract:  sea_socket/campgvg.json (cache BE committed, FE không biết) ──▶ config cho transform
              └─ chỉ extract lại khi nghi drift — xem mục "Cache config CampGVG"
[3] transform + dump CLI riêng: sea_socket/report.py (re-dump run cũ, bake chính thức)
              ├─ default ──▶ public/sea-live-dev.json (gitignored)
              ├─ --out src/data/sea-live.json ──▶ commit = bake vào build (live)
              └─ --snapshot [--server N] ──▶ src/data/snapshots/<YYMMDD>/<server>.json (commit = lịch sử)
[4] src/data/sea-live.ts  (adapter FE, viết tay) + sea-live.test.ts
                          ◀── liveDump — dev: fetch sea-live-dev.json, thiếu → fallback
                                         build: import src/data/sea-live.json (baked)
                          ◀── src/data/snapshots.ts: import.meta.glob lazy các snapshot
                          ──buildLiveData(dump)──▶ islands / contributions / routes / …
[5] FE: domain/mapData.ts buildMapData(dump) → derive owner/BXH/filter;
        stores/dataset.ts giữ bộ đang xem (cụm × ngày), component đọc useMapData()
```

Hai file JSON dump, cùng schema (chi tiết dev vs build, thuật ngữ dump/baked:
[`docs/sea/SEA_LIVE_DATA.md`](docs/sea/SEA_LIVE_DATA.md)):

- `public/sea-live-dev.json` — **gitignored**, dump mặc định mỗi lần crawl.
  FE dev server fetch lúc runtime: crawl xong, refresh browser là thấy, không
  đụng git. Thiếu file hay sai format → rơi về bản baked.
- `src/data/sea-live.json` — **committed**, snapshot "chính thức" baked vào
  bundle lúc build. Chỉ cập nhật chủ động bằng `--out src/data/sea-live.json`.

Ranh giới vai trò: **Python** (`tools/socket_log/sea_socket/report.py`) chỉ gom crawl outputs thành một
JSON thuần — `camp`, `owner`, `nodeRows`, `briefs`, `baseDir`, `snapshotAt` —
kèm cross-checks (base names, 4 owner base, node không map được layout) để bắt
join hỏng trước khi data đến FE. **FE** (`src/data/sea-live.ts`) là code viết
tay — `layoutIdOf` (prefix display id → layout id), `factionDir` (owner 4 base
→ hướng), join vào `layoutNodes` theo types `Contribution`/`Island` — có unit
test ở `src/data/sea-live.test.ts`. Crawl (dev hay ship) không bao giờ đè file code FE.

Auto-refresh trên bản deploy khi war (poll `fetch` dump chính thức + re-run
adapter trên data mới) chưa làm — adapter đã nhận data qua biến nên chỉ đổi
chỗ lấy data ở `src/data/sea-live.ts`, join giữ nguyên.

## Docs

- [`README.md`](README.md) — hướng dẫn chi tiết Web UI: tương tác, cấu trúc 89 node, kiến trúc `src/` và state management
- [`docs/DOCS_GUIDE.md`](docs/DOCS_GUIDE.md) — index toàn bộ docs, vai trò từng tài liệu và cách cập nhật
- [`docs/sea/SOCKET_PROTOCOL.md`](docs/sea/SOCKET_PROTOCOL.md) — reference protocol WS (framing, module/cmd, decode)
- [`docs/mine_docs/MINE_STRUCTURE.md`](docs/mine_docs/MINE_STRUCTURE.md) — cấu trúc world mỏ: map UI ↔ protocol (kèm [`docs/mine_docs/BACKLOG_MINE.md`](docs/mine_docs/BACKLOG_MINE.md))
- [`docs/sea/SEA_STRUCTURE.md`](docs/sea/SEA_STRUCTURE.md) — cấu trúc event Tranh Bá Tứ Hải: map UI ↔ protocol
- [`docs/LEADERBOARD_SPECS.md`](docs/LEADERBOARD_SPECS.md) — đặc tả BXH, cơ chế lọc guild/player canvas và tương tác UI/UX
- [`docs/SEA_EVENT_RULE.md`](docs/SEA_EVENT_RULE.md) — quy tắc game về chiếm cứ điểm: ngưỡng, đường nối, derive ownership
- [`docs/sea/SEA_LIVE_DATA.md`](docs/sea/SEA_LIVE_DATA.md) — các file JSON crawl sea: dump vs baked, dev dùng file nào, build/deploy dùng file nào
- [`docs/sea/`](docs/sea/) — docs tầng crawler/decode: protocol WS, phân tích packet, research notes & run capture
- `docs/assets/` — ảnh in-game dùng đối chiếu protocol
- [`docs/sea/BACKLOG_SEA.BE.md`](docs/sea/BACKLOG_SEA.BE.md) — các việc đã nhận biết chưa làm của nhánh Tranh Bá Tứ Hải & Web UI

Điểm còn mở/câu hỏi cần chủ dự án xác nhận được ghi ở tài liệu liên quan kèm nguồn, phương án tạm và trạng thái — xem [`docs/DOCS_GUIDE.md`](docs/DOCS_GUIDE.md).
