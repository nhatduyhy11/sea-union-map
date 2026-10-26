# BACKLOG MINE — Các việc tồn đọng nhánh Khai Thác Guild

> Nhánh nghiên cứu phụ trợ phục vụ bot/report khu mỏ (module `0x48`).
> Ưu tiên thấp hơn nhánh Tranh Bá Tứ Hải (Sea Union) & Web UI; chỉ thực hiện khi có nhu cầu mở rộng tính năng dashboard mỏ.
> Backlog chính của dự án xem tại: [`docs/BACKLOG.md`](../BACKLOG.md).

## 1. `mine_logger` parse thêm chuỗi thắng (streak) và tầng debuff vào tile state

Phát hiện 2026-10-23 từ capture `run-s7-lv8-v3` / `run-check-streak`.

- **Hiện trạng**: Popup "N|Lv Máy Đào Chính" (click máy claimer giữa sàn) hiển thị
  ribbon đỏ "**N Chuỗi thắng**" và icon nắm đấm + **số tầng debuff**. Cả hai render
  thuần từ tile state (`0x48/0x0002` hoặc `0x48/0x0007`), không sinh request riêng.
  Tuy nhiên, `parse_tile` trong `tools/socket_log/mine_socket/protocol.py` hiện tại
  chỉ giữ id và slot_no, bỏ qua hoàn toàn `f7` và packed timestamps của `f5`.
- **Dữ liệu decode**:
  - Chuỗi thắng: tile `f7` = repeated `{f1: slot_no, f2: streak}` (vd `{9001: 9, 9002: 0}`).
  - Tầng debuff: trong submessage của slot, `f5` = packed varints chứa các mốc timestamp
    hết hạn trong tương lai (+3600s/tầng). `tiers = len(chain)` (số tầng);
    `next_expiry = min(chain)` (thời gian đếm ngược = `next_expiry - now`).
- **Hướng fix**:
  - `tools/socket_log/mine_socket/protocol.py`: trong hàm `parse_tile`, giữ thêm
    `f7` (dict `slot_no -> streak`) và `f5` (parse packed varints thành list ts,
    hoặc gán luôn `tiers` và `next_expiry`) cho mỗi slot.
- **Tham chiếu**: [`2026-10-23-mine-streak-debuff-decode.md`](2026-10-23-mine-streak-debuff-decode.md),
  [`MINE_STRUCTURE.md`](MINE_STRUCTURE.md) §4.

## 2. `mine_report` hiển thị chuỗi thắng, số tầng debuff và cảnh báo biến động

Phát hiện 2026-10-23 khi rà soát nghiệp vụ khu mỏ.

- **Hiện trạng**: `tools/socket_log/mine_socket/report.py` tổng hợp 5 raw stream
  thành `mine-report.json` và cây report text, nhưng chưa đưa streak và debuff vào
  output điểm mỏ.
- **Việc**:
  1. Thêm vào mỗi point thông tin `streak` (theo slot, đặc biệt slot claimer 9001-9003)
     và `debuff_tiers` / `debuff_expiry`.
  2. Bổ sung cơ chế so sánh giữa 2 lần snapshot (hoặc theo delta `0x48/0x0008`):
     cảnh báo khi chuỗi thắng bị đứt hoặc số tầng debuff tăng/giảm.
- **Tham chiếu**: [`2026-10-23-mine-streak-debuff-decode.md`](2026-10-23-mine-streak-debuff-decode.md).

## 3. Giải mã các trường còn lại trong tile mỏ (`f6`, `f8/f9`, slot `f3`)

Phát hiện 2026-10-23 qua capture probe tile fields.

- **Hiện trạng**:
  - Tile `f6`: xuất hiện `{9001|9002: 0}` trên một số tile (nghi sự kiện chiếm điểm gần nhất).
  - Tile `f8/f9`: hiếm gặp; khi có thì `f8 - f9 = đúng 3600s` (thấy trên tile 1060, 4044, 6052).
  - Slot `f3`: luôn = 0 (2 captures kiểm tra đều = 0, xác nhận không phải tầng debuff).
  - Lô 11 player id thứ hai xuất hiện lúc zoomin mỏ và feed history type 1 `[7057, 10, ts]`.
- **Việc**: Reverse-engineer và giải mã dứt điểm khi bot hoặc dashboard khu mỏ cần đến.
- **Tham chiếu**: [`../SOCKET_PROTOCOL.md`](../SOCKET_PROTOCOL.md) § Đang mở, [`MINE_STRUCTURE.md`](MINE_STRUCTURE.md) §6.
