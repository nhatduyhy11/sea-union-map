# BACKLOG SEA — Kế hoạch & Các việc tồn đọng

> Việc ghi vào đây khi phát hiện hoặc chốt yêu cầu mới; mỗi mục ghi đủ context +
> hướng fix để người sau pick up không phải đào lại. Lệch số UI vs game riêng
> một file: [`docs/sea/STATS_MISMATCH.md`](STATS_MISMATCH.md).
>

---

## I. Crawler & Backend Python

### 1. Cache brief guild + player dùng chung cho pipeline mine & sea (default cụm 517)

Ý tưởng chốt 2026-10-28 — giảm thời gian fetch nói chung của cả hai nhánh:
brief player/guild hiện bị hỏi lại ở mỗi run dù id đã từng gặp.

- **Hiện trạng**:
  - Player brief: fetch theo lô 60 id qua inject `0x0d/0x001f` → `0x0d/0x0020`
    — sea dùng ở brief phase của `tools/socket_log/sea_socket/crawler.py` +
    `tools/socket_log/sea_socket/brief_backfill.py`; mine dùng `NameFetcher`
    (`tools/socket_log/core/runner.py`).
  - Guild brief: `0x24/0x0035 → 0x0036` (`GUILD_BRIEF_CMD`,
    `tools/socket_log/core/protocol.py`).
  - Brief chỉ sống trong output từng run (`players.jsonl`), không có nơi lưu
    chung → lần crawl sau hỏi lại từ đầu. Throttle risk: batch 60 id từng trả
    về rỗng (seq=169), phải backfill bằng chunk 20 + pace 0.8s (evidence
    2026-10-27 trong `brief_backfill.py`).
- **Hướng làm**:
  - Persistent brief cache theo cụm server: **mặc định `517`**, nhận input
    khác qua CLI (vd `--server 590`) — 1 file/cụm, format `{id: brief}` cho
    cả player lẫn guild (vd `tools/socket_log/briefs/517.json`; tên/chỗ để
    chốt khi làm).
  - Flow chuẩn: load cache → lọc bỏ id đã có → chỉ fetch phần thiếu → merge
    bổ sung vào cache ngay khi có response. Gặp id nào chưa có trong cache
    thì tự động update bổ sung.
  - Option `--force-rebuild`: bỏ qua cache, hỏi lại toàn bộ rồi ghi đè (khi
    nghi stale — đổi tên guild, power drift, cache hỏng).
  - Module dùng chung đặt ở `tools/socket_log/core/` để cả `sea_socket/` lẫn
    `mine_socket/` import được.
- **Lưu ý**: cache phải tách theo cụm server (brief có field server, id có
  thể trùng giữa các cụm); khớp với hướng multi-server (guild identity dùng
  `guildId` từ game).

### 1b. Guild brief trả rỗng với guild inactive — crawler cần retry riêng

Ghi 2026-10-28 (run `.tmp/sea-crawl/sea-crawl-20261028-192132`, profile p545).

- **Hiện trạng**: guild brief `0x24/0x0035 → 0x0036` giờ là nguồn lực chiến
  guild (`f3.f16`, parse trong `core/protocol.py` → dump key `guildPower`).
  Run này 114/115 guild trả đủ; guild `5270018` (phe 4, điểm 0) trả `f3` rỗng
  → thiếu cả tên lẫn power, UI hiện `#5270018 [—]`.
  - Roster 4 member: `52709342`, `52719518`, `52749342`, `52799012` — không
    ai có brief, không ai lọt `nodeRows`/`playerBoard` (guild không hoạt động
    trong event).
  - Crawler (`sea_socket/crawler.py`, vòng guild brief) hỏi mỗi guild **1 lần,
    không retry** — response rỗng là mất luôn tới run sau.
- **Giả thuyết (chưa xác nhận)**: server xếp brief guild inactive vào hàng
  low-priority / cache lạnh → lần hỏi đầu trả rỗng, hỏi lại sau mới có. Khớp
  evidence cũ trong `brief_backfill.py`: 2026-10-27 16 guild rỗng lúc
  07:26 + 07:45, 12 guild còn thiếu trả đủ ngay chiều cùng ngày.
- **Hướng làm**:
  - Crawler: guild nào response rỗng (`name` null) thì đưa vào hàng retry
    cuối phase, backoff tăng dần (cùng kiểu `RETRY_BACKOFF` của backfill), vài
    vòng; vẫn rỗng thì log id + giữ fallback FE (cộng power brief member).
  - Kiểm chứng giả thuyết: thử hỏi lại `5270018` vài lần cách nhau (ngay /
    vài phút / vài giờ); thử brief player 4 member để xem có cùng bị rỗng
    không (inactive cả account hay chỉ guild).
  - Tạm thời lấp tay: `brief_backfill.py --run <run> --guilds` rồi re-dump.

---

## II. Canvas & Map

### 2. Thanh Snapshot lịch sử các ngày event dưới label 4 phe của canvas

Hiển thị các mốc lịch sử diễn ra sự kiện để người dùng có thể xem lại diễn biến bản đồ qua các ngày.

- **Vị trí**: Đặt ở phía dưới thanh nhãn màu 4 phe của canvas (`src/components/map/map-footer/FactionLegend.tsx`).
- **Giao diện**: Dãy nút thể hiện các ngày snapshot trong event, ví dụ: `[26]`, `[27]`, ...
- **Quy tắc hiển thị**:
  - Chỉ hiển thị nút của những ngày **đã qua mốc 22:00** (thời điểm kết thúc lượt đánh trong ngày của game). Các ngày chưa tới hoặc chưa qua 22h sẽ không xuất hiện.
- **Tương tác & Xử lý dữ liệu**:
  - Khi click vào nút một ngày hợp lệ: nạp lại toàn bộ dữ liệu cũ (snapshot) của ngày đó vào tất cả các tab hiện tại trên UI (canvas, BXH phe, BXH cứ điểm, cá nhân, node details).
  - Trạng thái nút: Nút của ngày đang được chọn sẽ sáng (active state) để báo hiệu đang xem snapshot lịch sử.
  - Trường hợp không có dữ liệu: nếu click vào ngày không có data snapshot tương ứng, bắn Toast thông báo lỗi (Toast Error), nút không click được / không đổi trạng thái và không làm xáo trộn màn hình hiện tại.
- **Chỗ sửa**:
  - Thêm component SnapshotBar / cập nhật `src/components/map/map-footer/FactionLegend.tsx`.
  - Store quản lý active snapshot date và logic load dữ liệu lịch sử từ các file `src/data/sea-live.<date>.*.json`.
  - Tích hợp Toast notification cho trường hợp nạp dữ liệu thất bại.

---

## III. Web UI & Layout

### 3. Server Switcher trên Header (`[517]`, `[590]`...) — không có nút manual new

Cho phép chuyển đổi nhanh dữ liệu hiển thị giữa các cụm server đã crawl.

- **Vị trí**: Trên thanh header ứng dụng (`src/components/layout/AppHeader.tsx`).
- **Giao diện**: Các nút bấm chuyển đổi mang tên/mã số từng server, ví dụ: `[517]`, `[590]`, `[643]`, `[777]`. Nút của server đang kích hoạt có style active riêng.
- **Nguyên tắc kỹ thuật**: **KHÔNG CÓ NÚT TẠO MỚI THỦ CÔNG (manual new)** — vì toàn bộ logic lấy và bóc tách dữ liệu server được thực hiện manual bằng pipeline backend nội bộ, không expose API hay thao tác tạo server ra phía client.
- **Hành vi**: Khi click vào một server button: chuyển đổi active server, load bộ dữ liệu tương ứng của server đó vào store và render lại toàn bộ giao diện (map layout, faction scores, leaderboards).
- **Chỗ sửa**: `src/components/layout/AppHeader.tsx`, store quản lý server hiện tại (`useServerStore` hoặc tích hợp vào app state), data loader trong `src/data/sea-live.ts`.
- **Phụ thuộc**: guild identity đa server đã hoàn tất theo hướng dùng `guildId` từ game (commit `c8c3fe1`).

---

## Nhánh phụ: Khai Thác Guild (Mine)

Các việc tồn đọng thuộc nhánh Khai Thác Guild (module `0x48`, logger, report, streak/debuff) có mức ưu tiên thấp hơn và được quản lý riêng tại:
👉 [`docs/mine_docs/BACKLOG_MINE.md`](../mine_docs/BACKLOG_MINE.md).
