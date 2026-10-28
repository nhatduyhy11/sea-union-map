# BACKLOG SEA — Kế hoạch & Các việc tồn đọng

> Việc ghi vào đây khi phát hiện hoặc chốt yêu cầu mới; mỗi mục ghi đủ context +
> hướng fix để người sau pick up không phải đào lại. Lệch số UI vs game riêng
> một file: [`docs/sea/STATS_MISMATCH.md`](STATS_MISMATCH.md).
>
> Các mục quick-win UI đã xử lý xong (map init, màu 4 phe, tên căn cứ,
> watermark, footer, tab mặc định, sidebar scroll, sort vùng member, collapse
> guild) đã drop khỏi danh sách — xem git log các commit `feat(canvas)`,
> `feat(ui)`, `fix(leaderboard)`, `feat(layout)` (2026-10-27). Mục "CampGVG
> config nằm ở `.tmp`" đã xử lý 2026-10-28 (`sea_socket/campgvg.json` committed,
> `crawler.py --dump`) — xem commit `feat(sea)` + `README.BE.md`.

---

## I. Crawler & Backend Python

### 1. Crawler entry fail khi game load chậm — `sleep:8` cứng, không có bước chờ home ready

Phát hiện 2026-10-26, run `sea-crawl-20261026-195342`.

- **Hiện tượng**: fail ở `expect:2a-event-lobby-start` (stage `login`) — evidence
  `screens/FAIL-expect-2a-event-lobby-start.png` vẫn là màn hình loading 73%.
  Game socket mở ở t+19.7s trong khi stage `login` chỉ `sleep:8` rồi chạy
  popclose; popclose "queue drained" trên loading screen (checkbox score 0.821
  < 0.97 — không có splash nào để khớp), click outside (424,688) bị nuốt khi
  loading chưa xong → không vào được event lobby.
- **Điều kiện tái**: cache profile ngu (lần chạy đầu của phiên, asset chưa
  cached). Run kế tiếp `sea-crawl-20261026-195529` với cùng lệnh pass toàn bộ.
  Rerun tay hiện là workaround tạm thời.
- **Hướng fix**: thay `sleep:8` cứng trong STAGES bằng bước chờ sẵn sàng —
  ví dụ verb `await:<golden>` (loop expect đến khi similarity ≥ ngưỡng hoặc hết
  hạn, screenshot evidence mỗi lần thử), hoặc tối thiểu chờ WS game mở + thêm
  expect-retry trước khi vào popclose. Sửa ở `tools/socket_log/sea_socket/walkthrough.py` (STAGES) +
  `tools/socket_log/capture/capture.py` (run_step) — vẫn thuần Python/template matching, không
  đụng phần inject của `tools/socket_log/sea_socket/crawler.py`.

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
- **Phụ thuộc**: nên chốt guild identity đa server (mục 4) trước khi làm để tránh đổi identity hai lần.

---

## IV. Bảng Xếp Hạng (BXH / Leaderboard)

### 4. Nhận diện Guild đa server: đổi identity sang `guildName_serverNumber`

Phát hiện 2026-10-26 — tránh xung đột dữ liệu giữa các server.

- **Vấn đề**: Hiện đang dùng tên bang làm id (`CanvasFilter`, `src/domain/selectors/` nhóm theo `player.guild`). Khi chạy multi-server, hai guild cùng tên ở hai server khác nhau (vd `HUNTERS` ở S517 và S590) sẽ bị gộp chung làm một row, gây sai lệch điểm và drill-down.
- **Hướng fix**:
  - Đổi guild identity nội bộ thành dạng `guildName_serverNumber` (vd: `HUNTERS_517`), trong khi display name trên UI vẫn giữ nguyên là `guildName`.
  - Cập nhật `CanvasFilter` (`src/types.ts`), bucket & drill-down (`src/domain/selectors/`), filter matching ở canvas và legend.
  - Bucket `"Không guild"` vẫn giữ nguyên; `guild_id` số từ game giữ làm evidence.

### 5. BXH Cứ điểm: Expand hiển thị BXH player fetch in-game & clear selection khi đóng

Cung cấp thông tin chi tiết người chơi tấn công cứ điểm và gỡ viền highlight khi đóng hàng.

- **Vấn đề / Việc cần làm**:
  1. **Hiển thị BXH người chơi của node**: Khi expand một cứ điểm trong tab Cứ điểm (`src/components/panels/leaderboard/NodeBoard.tsx`), mục `.allocation` hiện tại chỉ hiển thị điểm 4 phe, thiếu danh sách người chơi. Cần bổ sung bảng người chơi tham gia đóng góp/tấn công cứ điểm đó (tương tự `PlayerTable` trong `NodeDetails`, hiển thị tên, phe, guild, điểm đóng góp).
  2. **Clear selection khi đóng hàng**: Khi toggle đóng một cứ điểm trong `src/components/panels/leaderboard/NodeBoard.tsx`, nếu node đó đang là node được chọn trên map (`selected === entry.island.id`) thì gọi `close()` để gỡ viền active.
- **Chỗ sửa**: `src/components/panels/leaderboard/NodeBoard.tsx`, `src/domain/selectors/` (query player contributions cho từng node).

---

## Nhánh phụ: Khai Thác Guild (Mine)

Các việc tồn đọng thuộc nhánh Khai Thác Guild (module `0x48`, logger, report, streak/debuff) có mức ưu tiên thấp hơn và được quản lý riêng tại:
👉 [`docs/mine_docs/BACKLOG_MINE.md`](../mine_docs/BACKLOG_MINE.md).
