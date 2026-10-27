# Sea Union

Web UI (React Flow) xem map **Tranh Bá Tứ Hải** theo data crawl, và crawler
Python bắt/giải mã packet websocket của game H5. Repo gồm hai nửa nối nhau bằng
pipeline crawl → JSON → UI:

- `tools/socket_log/` — crawler & decoder WS, 2 mode: **mine** (Khai Thác
  Guild) và **sea** (Tranh Bá Tứ Hải)
- `src/` — web UI React + React Flow, chạy hoàn toàn phía trình duyệt

## Web UI

### Chạy

```sh
npm install
npm run dev
```

Mở URL local Vite in ra. `npm run build` tạo bản static trong `dist/`; `npm test` kiểm tra cấu trúc map và đối chiếu điểm.

### Tương tác

- Kéo nền để pan, cuộn/pinch để zoom, nút **Toàn cảnh** để fit map.
- Hover hoặc focus đảo để xem điểm bốn phe; click icon mở panel chi tiết.
- Nút ghim từng đảo giữ bảng điểm; **Điểm toàn map** hiện mọi bảng. Tắt tùy chọn chung vẫn giữ các đảo được ghim riêng.
- Lọc canvas theo guild hoặc thành viên trực tiếp từ BXH (xem [docs/LEADERBOARD_SPECS.md](docs/LEADERBOARD_SPECS.md)); legend chân map hiển thị màu phe.
- Tìm ID/tên đảo để tới đảo; tab xếp hạng mở phân bố điểm của từng player và liên kết tới cứ điểm.

### Map & dữ liệu

Map có 89 node: 24 đảo tầng 1, 52 đảo tầng 2, 9 cứ điểm trên hàng giữa và 4 base. `src/data/map-layout.ts` chứa ID, tọa độ ghép từ `specs/map-left.PNG`, `map-mid.PNG`, `map-right.PNG` và 118 đường nối đọc từ ảnh. Tọa độ được phóng đồng đều để giữ tỷ lệ bố cục và khoảng cách. Không sinh map bằng cách xoay một cụm node; các index thật được khai báo riêng ở đúng khu vực trong ảnh.

Cứ điểm trung tâm là `4` — là tâm tọa độ của map. Dãy cứ điểm trục giữa gồm 9 node theo index từ tây sang đông: `3-7`, `3-5`, `3-3`, `3-1`, `4` (tâm), `3-2`, `3-4`, `3-6`, `3-8`. Layout đặt tên chuẩn theo index (`Đảo 1-x`, `Đảo 2-x`, `Cứ điểm 3-x/4`); khi bật live, tên hiển thị lấy từ config CampGVG của game. Các base không có index trong ảnh nên dùng ID nội bộ `base-north/east/south/west`.

Nguồn dữ liệu chọn bằng cờ `LIVE` ở `src/domain/mapData.ts`:

- **Live (mặc định)** — crawl thật từ server, bake vào `src/data/sea-live.json`: tên node và ngưỡng chiếm từ config CampGVG, owner từ snapshot server (`0x72/0x000c`), điểm từ board từng node. Join game-id → layout-id nằm ở adapter `src/data/sea-live.ts`, có unit test; các lệch số so với UI game đã biết liệt kê ở [docs/STATS_MISMATCH.md](docs/STATS_MISMATCH.md). Owner là truth từ server — claim rule chỉ còn tính connectivity (phe nào còn nối base tới node). Boss chưa map (`null`) — detail nằm ở config khác.
- **Demo** — đặt `LIVE = false` để xem lại dữ liệu mẫu `src/data/demo.ts`; owner derive từ claim rule. `src/domain/selectors.ts` tính điểm phe và leaderboard từ cùng nguồn cho cả hai mode.

Bốn base không có điểm tấn công. Bảng điểm co giãn theo zoom; zoom gần hơn để đọc. Chưa có nhập dữ liệu, lưu trạng thái hay đồng bộ giữa người dùng; ghim, lọc và các lựa chọn chỉ tồn tại trong phiên trang hiện tại.

### Tổ chức code

- `src/main.tsx`: khởi tạo React và nạp CSS.
- `src/App.tsx`: bố cục ứng dụng — thuần layout, component tự nối store nên không threaded props.
- `src/components/layout/`: header và thanh điều hướng.
- `src/components/map/`: map, custom node/edge, toolbar, bảng điểm nhỏ và chú giải.
- `src/components/panels/`: panel cứ điểm, bảng điểm phe, player và leaderboard.
- `src/components/shared/`: UI dùng chung.
- `src/stores/`: zustand store chia theo loại state — `mapView` (lọc guild/player, điểm toàn map, debug), `panel` (tab, sub-tab BXH, filterMode, accordion expansion), `selection` (chọn/ghim đảo); `commands.ts` gom tương tác chạm nhiều store (`openIsland`, `setFilterMode`, `resetRankingView`). Chi tiết mô hình tương tác tại [docs/LEADERBOARD_SPECS.md](docs/LEADERBOARD_SPECS.md).
- `src/hooks/`: derived data và command cần instance React Flow — `useMapGraph` (nodes/edges), `useNodeDetails`, `useIslandMatches`, `useFocusIsland`, `useFitMap`.
- `src/domain/`: hàm thuần tính điểm, truy vấn chi tiết, tìm kiếm, chọn nguồn dữ liệu (`mapData.ts`, cờ `LIVE`) và chuyển dữ liệu sang model React Flow; kèm test.
- `src/data/`: bố cục theo ảnh, định nghĩa phe, fixture demo và dữ liệu crawl live (`sea-live.json` + adapter `sea-live.ts`).
- `src/types.ts`: định nghĩa kiểu dữ liệu (model, props, React Flow node data).
- `src/utils/format.ts`: định dạng số để hiển thị.
- `src/style.css`: global CSS reset, typography, scrollbar và React Flow styles; UI dùng CSS Modules co-located theo từng component.

UI nhận dữ liệu đã chuẩn bị qua props; component subscribe store theo slice nên mỗi tương tác chỉ re-render vùng liên quan. Command chạm nhiều store nằm ở `stores/commands.ts`; command cần camera (focus/fit) là hook vì cần instance React Flow. Domain không import React, component hay store. Derived data (nodes/edges, chi tiết đảo, kết quả tìm kiếm) memo theo state đầu vào; điểm và leaderboard không tính lại theo mỗi thao tác pan/zoom.

## Crawler (`tools/socket_log/`)

Có **2 mode** dùng chung một tầng generic — chọn mode theo entry point:

- **Mode sea** — Tranh Bá Tứ Hải (module 0x72 + board 0x0c), kèm pipeline crawl → JSON cho FE
- **Mode mine** — event world mỏ (module 0x48 + broadcast type 150)

Layout: 3 package generic (`core/`, `browser/`, `capture/`) + 2 package event
(`sea_socket/`, `mine_socket/`) độc lập nhau — xóa 1 package event thì package
kia vẫn chạy bình thường; `config_extract.py` đứng top-level vì không đụng socket.

### Dùng chung

| File                       | Vai trò                                                                                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/runner.py`           | Core runner: session Chrome persistent, hook WS, sink JSONL, fetch tên người chơi qua injected request, các chế độ chạy (forever / `--duration` / `--snapshot`)            |
| `capture/capture.py`       | Bắt frame thô: dump payload nguyên vẹn ra `frames/NNNNN-{S\|R}.bin` + `index.jsonl`, kèm step DSL (`click:X,Y`, `shot:NAME`, `sleep:S`, `mark:LABEL`) + golden             |
| `core/decode.py`           | Decoder wire-format generic (không cần schema `.proto`), annotate timestamp heuristic                                                                                      |
| `core/protocol.py`         | Protocol tầng game dùng chung: broadcast bus (0x13), player/guild brief (0x0d/0x24), `frame_is`, `build_brief_request`, convention inject ssid `0xF0..0xFF`                |
| `core/args.py`             | CLI args dùng chung của logger (`--profile/--url/--dir/--snapshot/--duration/...`)                                                                                         |
| `core/runtime_codec.py`    | Decode frame nén/không schema qua runtime game headless (`window.__require`): QuickLZ + BufferUtils; mode `rank` (0x0c/0x0003) / `briefs` (0x0d/0x0020), `--cut` tách body |
| `browser/process_guard.py` | Lock theo profile (chặn chạy 2 instance) + xử lý stop signals                                                                                                              |
| `browser/page_guards.py`   | Chặn popup profile, ẩn iframe H5 SDK (inlined từ bot cũ)                                                                                                                   |
| `browser/navigation.py`    | `navigate_to_game` có retry qua transient hang (inlined từ bot cũ)                                                                                                         |

### Mode 1 — sea (`sea_socket/`)

Pipeline chuẩn: crawl → bóc config → dump JSON cho FE — luồng đầy đủ tới UI
xem mục **Luồng crawl → UI** bên dưới.

| File                        | Vai trò                                                                                                                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sea_socket/walkthrough.py` | Walkthrough GUI: stage DSL login → lobby → battle map → node detail/boss/board, chụp bằng chứng từng bước (chỉ để proof protocol)                                                         |
| `sea_socket/crawler.py`     | **Collector chính**: mở map 1 lần lấy snapshot 89 node, rồi inject `0x72/0x0011` + board `0x0c/0x0002` theo id — không đụng UI; decode board bằng runtime game                            |
| `sea_socket/protocol.py`    | Module 0x72 + rank 0x0c: frame builder, parse snapshot/node state (pure, testable)                                                                                                        |
| `sea_socket/report.py`      | Dump crawl JSONL + CampGVG thành JSON thuần cho FE (mặc định `public/sea-live-dev.json` gitignored; `--out src/data/sea-live.json` để bake vào build); lệch số ở `docs/STATS_MISMATCH.md` |
| `config_extract.py`         | Bóc bảng config client (CampGVG…) headless **không cần login**: boot page game, dump `window.__require(<TABLE>).store` ra JSON                                                            |

```bash
# [1] Crawl đủ 89 node (headed mặc định, cần session đăng nhập)
uv run python tools/socket_log/sea_socket/crawler.py --profile .tmp/pmain
#    → .tmp/sea-crawl/<run>/: map-snapshot.json, node-states.jsonl,
#      boards-decoded.json, players.jsonl, summary.json

# [2] Bóc config CampGVG (không cần login) — chỉ chạy 1 LẦN rồi reuse:
#    campgvglo.json để nguyên trên đĩa, các lần crawl sau không cần bước này.
#    Chỉ chạy lại khi game deploy bundle mới mà config đổi (season mới, sửa node).
uv run python tools/socket_log/config_extract.py --table CampGVGLO \
    --out .tmp/sea-crawl/campgvglo.json

# [3] Dump JSON cho FE (dev: public/sea-live-dev.json, gitignored)
uv run python tools/socket_log/sea_socket/report.py --crawl .tmp/sea-crawl/<run> \
    --config .tmp/sea-crawl/campgvglo.json
#    Bake chính thức vào build:
uv run python tools/socket_log/sea_socket/report.py --crawl .tmp/sea-crawl/<run> \
    --config .tmp/sea-crawl/campgvglo.json --out src/data/sea-live.json
```

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

Logger ghi thẳng **JSONL đã decode** (không phải binary): `mine-events.jsonl`,
`player-briefs.jsonl`, `guild-briefs.jsonl` dưới `.tmp/mine-events/`.

```bash
# Snapshot nhanh: 1 pass state + tên, rồi thoát
uv run python tools/socket_log/mine_socket/logger.py --profile .tmp/pmain --snapshot

# Logger dài hạn, tự dừng sau 5 phút
uv run python tools/socket_log/mine_socket/logger.py --profile .tmp/pmain --duration 300

# Báo cáo từ JSONL đã ghi (mặc định --dir .tmp/mine-events)
uv run python tools/socket_log/mine_socket/report.py

# Decode offline từ capture binary của capture/capture.py
uv run python tools/socket_log/mine_socket/decode.py .tmp/socket-capture/run-mine1 mine-events
```

### Prerequisite

Cả hai mode đều cần profile `.tmp/<name>` đã có session đăng nhập (persistent
context của Playwright). Riêng `config_extract.py` boot headless không cần
login.

## Luồng crawl → UI

```
[1] sea_socket/crawler.py ──crawl WS game──▶  .tmp/sea-crawl/<run>/ (JSONL + boards-decoded.json)
[2] config_extract.py     ──boot game headless──▶ .tmp/sea-crawl/campgvglo.json (CampGVG 89 row)
[3] sea_socket/report.py  ◀── đọc [1] + [2] ──dump──▶ public/sea-live-dev.json (MẶC ĐỊNH — gitignored)
                                                     hoặc src/data/sea-live.json (--out, commit = bake vào build)
[4] src/data/sea-live.ts  (adapter FE, viết tay) + sea-live.test.ts
                          ◀── dev: fetch sea-live-dev.json, thiếu → fallback
                              build: import src/data/sea-live.json (baked)
                          ──export──▶ islands / contributions / routes
[5] FE: mapData.ts (LIVE switch) → derive owner/BXH/filter từ contributions
```

Hai file JSON dump, cùng schema:

- `public/sea-live-dev.json` — **gitignored**, dump mặc định mỗi lần crawl.
  FE dev server fetch lúc runtime: crawl xong, refresh browser là thấy, không
  đụng git. Thiếu file hay sai format → rơi về bản baked.
- `src/data/sea-live.json` — **committed**, snapshot "chính thức" baked vào
  bundle lúc build. Chỉ cập nhật chủ động bằng `--out src/data/sea-live.json`.

Ranh giới vai trò: **Python** (`sea_socket/report.py`) chỉ gom crawl outputs thành một
JSON thuần — `camp`, `owner`, `nodeRows`, `briefs`, `baseDir`, `snapshotAt` —
kèm cross-checks (base names, 4 owner base, node không map được layout) để bắt
join hỏng trước khi data đến FE. **FE** (`src/data/sea-live.ts`) là code viết
tay — `layoutIdOf` (prefix display id → layout id), `factionDir` (owner 4 base
→ hướng), join vào `layoutNodes` theo types `Contribution`/`Island` — có unit
test ở `sea-live.test.ts`. Crawl (dev hay ship) không bao giờ đè file code FE.

Auto-refresh trên bản deploy khi war (poll `fetch` dump chính thức + re-run
adapter trên data mới) chưa làm — adapter đã nhận data qua biến nên chỉ đổi
chỗ lấy data ở `sea-live.ts`, join giữ nguyên.

## Docs

- [`docs/DOCS_GUIDE.md`](docs/DOCS_GUIDE.md) — index toàn bộ docs, vai trò từng tài liệu và cách cập nhật
- [`docs/SOCKET_PROTOCOL.md`](docs/SOCKET_PROTOCOL.md) — reference protocol WS (framing, module/cmd, decode)
- [`docs/mine_docs/MINE_STRUCTURE.md`](docs/mine_docs/MINE_STRUCTURE.md) — cấu trúc world mỏ: map UI ↔ protocol (kèm [`docs/mine_docs/BACKLOG_MINE.md`](docs/mine_docs/BACKLOG_MINE.md))
- [`docs/SEA_STRUCTURE.md`](docs/SEA_STRUCTURE.md) — cấu trúc event Tranh Bá Tứ Hải: map UI ↔ protocol
- [`docs/LEADERBOARD_SPECS.md`](docs/LEADERBOARD_SPECS.md) — đặc tả BXH, cơ chế lọc guild/player canvas và tương tác UI/UX
- [`docs/SEA_EVENT_RULE.md`](docs/SEA_EVENT_RULE.md) — quy tắc game về chiếm cứ điểm: ngưỡng, đường nối, derive ownership
- [`docs/STATS_MISMATCH.md`](docs/STATS_MISMATCH.md) — các lệch số UI vs game đã biết (backlog handoff)
- `docs/planning/` — research notes và run capture (socket step learn, sea capture)
- `docs/assets/` — ảnh in-game dùng đối chiếu protocol
- [`BACKLOG.md`](BACKLOG.md) — các việc đã nhận biết chưa làm của nhánh Tranh Bá Tứ Hải & Web UI

Điểm còn mở/câu hỏi cần chủ dự án xác nhận được ghi ở tài liệu liên quan kèm nguồn, phương án tạm và trạng thái — xem [`docs/DOCS_GUIDE.md`](docs/DOCS_GUIDE.md).
