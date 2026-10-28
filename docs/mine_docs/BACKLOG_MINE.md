# BACKLOG MINE — Các Việc Tồn Đọng Nhánh Khai Thác Guild

> **Tài liệu hợp nhất toàn bộ open issues / backlog của nhánh Khai Thác Guild (Khu Mỏ).**
> Được merge từ `docs/sea/SOCKET_PROTOCOL.md` (§ Đang mở), `docs/mine_docs/MINE_STRUCTURE.md` (§ 6), và `BACKLOG_MINE.md` cũ.
>
> ⚠️ **Ưu tiên:** Thấp hơn nhánh Tranh Bá Tứ Hải (Sea Union) & Web UI; chỉ thực hiện khi có nhu cầu mở rộng tính năng dashboard/bot mỏ.
> Backlog nhánh Tranh Bá Tứ Hải & Web UI xem tại: [`docs/sea/BACKLOG_SEA.md`](../sea/BACKLOG_SEA.md).
> Cấu trúc world mỏ xem tại: [`MINE_STRUCTURE.md`](MINE_STRUCTURE.md).

---

## I. Parser & Protocol (`tools/socket_log/mine_socket/protocol.py`)

### 1. Parse thêm chuỗi thắng (streak) và tầng debuff vào tile state
*Nguồn: `BACKLOG_MINE.md` Task 1 & `MINE_STRUCTURE.md` §6.*

- **Hiện trạng:** Popup "N|Lv Máy Đào Chính" (click máy claimer giữa sàn) hiển thị ribbon đỏ "**N Chuỗi thắng**" và icon nắm đấm + **số tầng debuff**. Cả hai render thuần từ tile state (`0x48/0x0002` hoặc `0x48/0x0007`), không sinh request riêng. Tuy nhiên, `parse_tile()` trong `tools/socket_log/mine_socket/protocol.py` hiện tại chỉ giữ `id` và `slot_no`, bỏ qua hoàn toàn `f7` và packed timestamps của `f5`.
- **Dữ liệu decode đã xác minh:**
  - Chuỗi thắng: tile `f7` = repeated `{f1: slot_no, f2: streak}` (vd `{9001: 9, 9002: 0}`).
  - Tầng debuff: trong submessage của slot, `f5` = packed varints chứa các mốc timestamp hết hạn trong tương lai (+3600s/tầng). `tiers = len(chain)` (số tầng); `next_expiry = min(chain)` (thời gian đếm ngược = `next_expiry - now`).
- **Hướng fix:**
  - `tools/socket_log/mine_socket/protocol.py`: trong hàm `parse_tile()`, trích xuất thêm `f7` (dict `slot_no -> streak`) và `f5` (parse packed varints thành list timestamp, hoặc gán luôn `tiers` và `next_expiry`) cho mỗi slot.
- **Tham chiếu:** [`2026-10-23-mine-streak-debuff-decode.md`](2026-10-23-mine-streak-debuff-decode.md), [`MINE_STRUCTURE.md`](MINE_STRUCTURE.md) §4.

---

### 2. Map danh sách `action` 1–12, `9001/9002/9003` và template 28000
*Nguồn: `docs/sea/SOCKET_PROTOCOL.md` § Đang mở & `MINE_STRUCTURE.md` §6.*

- **Hiện trạng:** Trong `parse_mine_event()` (`tools/socket_log/mine_socket/protocol.py`), mã `action` chỉ được trích xuất dưới dạng số nguyên thô (`args[3][0]`).
- **Việc cần làm:**
  - Đối chiếu file JS bundle game (`assets/main/index.<hash>.js`) hoặc localization file để giải mã chính xác ý nghĩa từng mã hành động:
    - `9001`: vào khu / bắt đầu khai thác sàn chính.
    - `1–12`: các tương tác slot thường / bị đánh bại / rời slot (live quan sát thấy action `9001` rồi `12` cách nhau 6 giây).
    - `9002`, `9003`: hành động chiếm/giữ của slot claimer.
  - Template `28000`: template string in-game ("đồng quê tại…"). Cần map text để có thể render câu thông báo chuẩn in-game.

---

### 3. Giải mã các trường phụ còn lại trong tile mỏ (`f6`, `f8/f9`, slot `f3`, season tile ids)
*Nguồn: `BACKLOG_MINE.md` Task 3, `docs/sea/SOCKET_PROTOCOL.md` § State khu mỏ, `MINE_STRUCTURE.md` §6.*

- **Hiện trạng:**
  - Tile `f6`: xuất hiện `{9001|9002: 0 hoặc ts}` trên một số tile (nghi sự kiện chiếm điểm gần nhất).
  - Tile `f8/f9`: hiếm gặp; khi có thì `f8 - f9 = đúng 3600s` (thấy trên tile 1060, 4044, 6052 — nghi cửa sổ bảo vệ hoặc thời hạn chiếm điểm 1 giờ).
  - Slot `f3`: luôn = 0 (2 captures kiểm tra đều = 0, xác nhận không phải tầng debuff).
  - Season tile ids `513–544` trong `0x48/0x0014` (field `f3`): 32 giá trị liên tiếp (chưa rõ quy luật ánh xạ sang pos, khả năng là `map*100+tile`).
  - Timestamp mốc 05:23:35 "tương lai" ở slot `f5` (run-050330): kiểm tra lại cờ `[start, end]` vs window đặt trước.
- **Hướng fix:** Trích xuất thêm mẫu capture khi có biến động chiếm mỏ trực tiếp để decode dứt điểm.

---

### 4. Giải nghĩa feed lịch sử phụ (`0x48/0x001b`) và metadata phụ
*Nguồn: `docs/sea/SOCKET_PROTOCOL.md` § Đang mở & `MINE_STRUCTURE.md` §6.*

- **Hiện trạng:**
  - Envelope entry feed `0x48/0x001b` = `{f1: type, f2: JSON string}` — type 4 = `[player_id, pos, action, ts]` (action 9001/9002/9003, cùng nguồn sự kiện với broadcast type 150 — xem §2), type 1 = `[pos, slot_no, ts]`.
  - Entry type 1 `[7057, 10, ts]` trong feed `0x48/0x001b`: nghi là sự kiện riêng về slot của chính tài khoản đăng nhập (`7057` = pos, `10` = slot_no của acc HuAsura, khớp summary `f1`/`f2`), nhưng số lượng không khớp 1:1 với UI Lịch Sử.
  - Summary `f9 = {30000015, 3, 525}` trong `0x48/0x0002`: chưa rõ ý nghĩa nghiệp vụ.
  - Các field summary còn lại trong `0x48/0x0002`: `f4 = 4500`, `f8 = 51520`, `f6/f7/f10` = timestamp (`f6` ≈ thời điểm login) — chưa giải nghĩa.
  - Lô 11 player id thứ hai xuất hiện lúc click zoom-in vào một mỏ (sau lô 59 id của toàn bộ người trong mỏ).
- **Hướng fix:** Phân tích thêm flow click và kiểm tra xem type 1 có phải log cá nhân của riêng acc hay không khi có nhu cầu hiển thị log cá nhân.

---

## II. Aggregator & Report (`tools/socket_log/mine_socket/report.py`)

### 5. Hiển thị streak và tầng debuff lên output report & cảnh báo biến động
*Nguồn: `BACKLOG_MINE.md` Task 2 & `MINE_STRUCTURE.md` §6.*

- **Hiện trạng:** `tools/socket_log/mine_socket/report.py` tổng hợp 5 raw stream thành `mine-report.json` và cây report text, nhưng chưa đưa streak và debuff vào output điểm mỏ.
- **Việc cần làm:**
  1. Thêm vào mỗi point thông tin `streak` (theo slot, đặc biệt slot claimer 9001–9003) và `debuff_tiers` / `debuff_expiry`.
  2. Bổ sung cơ chế so sánh giữa 2 lần snapshot (hoặc theo delta `0x48/0x0008`): cảnh báo khi chuỗi thắng bị đứt hoặc số tầng debuff thay đổi.

---

## III. Thực nghiệm & Vận hành (Live Listener)

### 6. Chạy listener dài (~1 giờ+) kiểm chứng type 150
*Nguồn: `docs/sea/SOCKET_PROTOCOL.md` § Đang mở & `MINE_STRUCTURE.md` §6.*

- **Hiện trạng:**
  - Hạ tầng logger ([`tools/socket_log/mine_socket/logger.py`](../../tools/socket_log/mine_socket/logger.py)) đã hỗ trợ chạy dài hạn, lắng nghe `0x13/0x0004` (replay), `0x13/0x0007` (live push) và `0x48/0x0008` (tile delta).
  - Chưa chạy kiểm chứng thực nghiệm dài (>1h) khi có nhiều người cùng đào/chiếm mỏ để khẳng định 100% mọi biến động slot đều phát sinh broadcast type 150.
- **Việc cần làm:** Chạy `tools/socket_log/mine_socket/logger.py --duration 3600` trên một profile test vào khung giờ cao điểm tranh chấp mỏ, đối chiếu JSONL sinh ra với biến động in-game.

---

## IV. Các Mục Đã Hoàn Thành (Shipped & Solved)

Để tiện tra cứu và không cần đào lại:

- [x] **id → tên player:** Đã giải quyết hoàn toàn (100%) qua cơ chế inject `0x0d/0x001f` theo lô 60 id bằng `NameFetcher` (`tools/socket_log/core/runner.py`), response `0x0020` được xử lý tự động. Đã drop khỏi open issues.
- [x] **Cấu trúc bản đồ 65 tile / 1084 slot:** 7 sector, 16 mỏ phụ (mỗi mỏ 4 tile id tĩnh liên tiếp, id cao nhất là điểm level trên bot_right).
- [x] **Nhận diện Guild chủ điểm (`f4`):** Đã chốt `f4 = id guild claim`, tra tên qua `0x24/0x0035→0x0036`.
- [x] **Bộ 3 claimer sàn chính (slot 9001–9003):** Đã chốt 3 acc này cùng thuộc 1 guild và là guild claim `f4`. `tools/socket_log/mine_socket/report.py` tự động validate tính toàn vẹn này.
- [x] **Cơ chế fetch tên khi zoom-in:** Tên toàn bộ người trong mỏ fetch 1 lần khi zoom-in (59 id), không lazy theo điểm.
- [x] **Replay vs Live push:** `0x13/0x0004` là replay khi đăng nhập; `0x13/0x0007` là live push thời gian thực kèm tile delta `0x48/0x0008`.
