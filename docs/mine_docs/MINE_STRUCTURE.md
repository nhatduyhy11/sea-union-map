# Khai Thác Guild — Cấu Trúc Khu Mỏ (map UI ↔ protocol)

> Mô tả cấu trúc world mỏ từ ảnh in-game (`../assets/mine-detail/`)
> đối chiếu với state server đẩy về (`0x48/0x0002`, xem [`../sea/SOCKET_PROTOCOL.md`](../sea/SOCKET_PROTOCOL.md)).
> Ảnh tham chiếu: profile chính, acc **HuAsura** (id `51921435`, guild **HUNTERS**),
> đang ngồi **sector 7 — mỏ Mỏ Huyền Quang — điểm 4 (lv9)**, slot 10.
> Verify lần cuối: capture `run-20261023-050330` — tile `7057` slot `10` chứa đúng id `51921435`. ✓

## 1. World = 7 sector, 17 mỏ, 65 tile, 1084 slot

Màn "Khai Thác Guild" là bản đồ cuộn dọc, sector 1 (đáy) → sector 7 (đỉnh):

| Sector | Tên khu          | Level mỏ | Số mỏ          | Tile id (pos)             | Ghi chú                               |
| ------ | ---------------- | -------- | -------------- | ------------------------- | ------------------------------------- |
| 1      | Khu Mỏ Nguồn Cỏi | Lv1      | **1 mỏ phẳng** | 1001                      | **124 slot**, KHÔNG có slot 9001–9003 |
| 2      | Mỏ Đường Tắt     | Lv2–Lv3  | 5              | 2002–2021                 |                                       |
| 3      | Mỏ Thanh Tịnh    | Lv4–Lv5  | 4              | 3022–3037                 |                                       |
| 4      | Mỏ Hoang Vu      | Lv5–Lv6  | 3              | 4038–4045 **+ 1062–1065** | pos bị xáo trộn qua sector 5          |
| 5      | Mỏ Đá Cháy       | Lv6–Lv7  | 2              | 5046–5049 **+ 1058–1061** |                                       |
| 6      | Mỏ Gió Môn       | Lv7–Lv8  | 1              | 6050–6053                 |                                       |
| 7      | Mỏ Huyền Quang   | Lv8–Lv9  | 1              | 7054–7057                 | mỏ của HUNTERS (acc chính)            |

- Tổng: 16 mỏ thường × 4 điểm + 1 mỏ phẳng = **65 tile**; **1084 slot = 64×15 + 124** (khớp tuyệt đối với state parse được).
- **`pos` là id tĩnh trong bảng của server, KHÔNG phải `map*1000+tile`**: dãy id 58–65 bị "đặt nhầm"
  vào nhóm 1xxx dù thuộc sector 4/5 (xem bảng). Muốn biết sector: đọc `f2` của tile.
- Mỏ = **4 điểm có id liên tiếp**; trong mỗi mỏ, **điểm 1–3 = level dưới, điểm 4 = level trên**
  (vd sector 7: 7054/7055/7056 `f3=8`, 7057 `f3=9` — khớp title "Lv8-Lv9" và label "lv9" của điểm 4).

## 2. Điểm mỏ (tile) = 15 slot

Mỗi điểm là 1 "sàn Máy Đào Chính" với 15 slot = 12 slot thường + 3 slot claimer:

| Slot               | Số lượng | UI (view zoomin)                                                                                                                                                                                                                                                                                                                                                        |
| ------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–12               | 12       | Máy đào nhỏ có **tên player** đứng cạnh (zoomin hiện đủ 12 tên ở 7057)                                                                                                                                                                                                                                                                                                  |
| 9001 / 9002 / 9003 | 3        | **[x CHỐT 2026-10-23] slot claimer của điểm** ("Máy Đào Chính"): vẫn chứa player id trong state nhưng **không label tên**. Rule game: 3 acc này **phải cùng 1 guild** và guild đó **= guild đang claim điểm (`f4`)** — bot nhận diện guild chủ điểm ngay từ state, không cần request `0x24/0x0035`; lệch guild = data lỗi, `tools/socket_log/mine_socket/report.py` đưa vào mục `errors` |

- Sector 1 là ngoại lệ: 1 tile, slot 1–124, không có slot đặc biệt.
- Slot có player id = 0 là slot trống. Slot **đang đào** mang cặp timestamp ~60 phút (`f5`).

## 3. Các view UI (theo ảnh fixture)

1. **Sector overview** (`docs/assets/mine-detail/Sector7_lv8-lv9.png`): cuộn dọc qua 7 sector; mỗi mỏ hiện tên + số slot `(60/60)`;
   nhãn "Tôi" chỉ mỏ acc đang đứng; "Vị trí của tôi" góc dưới trái = quay về mỏ của mình.
2. **Zoomin** (`docs/assets/mine-detail/lv9-zoomin.png`): click vào 1 mỏ → nhìn gần các máy đào, **tên player hiện sẵn**,
   mỗi máy có badge level mỏ (vd "9"); **minimap thu nhỏ góc top-left**.
3. **Overview popup** (`docs/assets/mine-detail/lv9-overview.png`): click minimap → ảnh 4 vòng tròn = 4 điểm của mỏ
   (chấm **xanh = guild mình, đỏ = guild khác**), bên dưới là list **"Sàn Máy Đào Chính | guild | n/15 ▼"** — 4 dòng.
4. **Expand** (`docs/assets/mine-detail/lv9-expand.png`): bấm ▼ → list từng player trong điểm: **"Mỏ Quặng LvX | tên | guild"**.

## 4. Ánh xạ field protocol ↔ UI (trạng thái hiện tại)

| Field (tile `0x48/0x0002`) | Giá trị quan sát                          | Kết luận                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `f1` pos                   | 1001…7057                                 | id tĩnh tile (mục 1) — **đã chốt**, không mã hóa sector                                                                                                                                                                                                                                                                                                                       |
| `f2`                       | 1–7 = sector của tile                     | **Đã chốt** (khớp 65/65 tile với số mỏ từng sector)                                                                                                                                                                                                                                                                                                                           |
| `f3`                       | 1–9 = level điểm mỏ                       | **Đã chốt** (điểm 4 của mỏ luôn = level trên của title sector)                                                                                                                                                                                                                                                                                                                |
| `f4`                       | 0 hoặc `5XX00YY`                          | **[x CHỐT 2026-10-23] id guild chủ điểm**: 5170010=HUNTERS, 5140005=OLYMPUS, 5320011=LxVN — verify bằng cách request chính id này qua `0x24/0x0035` và guild detail `0x24/0x0034` trả `f1=5170010, f2="HUNTERS"`. f4=0 ở sector thấp (chưa/chẳng ai chiếm?)                                                                                                                   |
| `f5`                       | repeated slot                             | Xem mục 2                                                                                                                                                                                                                                                                                                                                                                     |
| `f6`                       | `{1: 9001, 2: 0 hoặc ts}` (chỉ 1 số điểm) | Nghi sự kiện **chiếm điểm** gần nhất (action 9001 + thời điểm)                                                                                                                                                                                                                                                                                                                |
| `f7`                       | repeated `{slot: streak}`                 | **[x CHỐT 2026-10-23] chuỗi thắng (win streak) theo slot** — key là **slot no** (1–12 + 9001–9003), không phải action như nghi ban đầu. Verify: tile 7055 slot 9001 (OLNaji) = 9 lúc 05:00 → **11 lúc ~10:15, đúng bằng "11 chuỗi thắng" hiện trong game**; slot thường đa số = 1, claimer thắng liên tiếp thì tăng (thắng = đẩy lùi attacker, xem 0x1f/0xb)                  |
| `f8`/`f9`                  | hiếm; khi có thì **f8 − f9 = đúng 3600s** | Cặp cửa sổ 1 giờ (nghi lần chiếm/đào gần nhất) — chưa chốt                                                                                                                                                                                                                                                                                                                    |
| slot `f1`/`f2`             | player id / số slot                       | id 0 = trống                                                                                                                                                                                                                                                                                                                                                                  |
| slot `f5`                  | packed ts                                 | **[x CHỐT 2026-10-23] chuỗi mốc hết-hạn +60 phút trong TƯƠNG LAI = số tầng debuff (icon nắm đấm trên popup "Lv\|Lv Máy Đào Chính")** — 战神 (7054, slot 9001): 4 mốc 11:04/12:04/13:04/14:04UTC = **4 tầng**, đếm ngược trên UI 16:40 = mốc đầu − now ✓; OLNaji (7055): 1 mốc = 1 tầng, 23:21 ✓; slot không có mốc = không icon. Đọc sai trước đây là "các phiên đào quá khứ" |

- **State `0x48` không chứa tên player/tên guild** — chỉ có id. Tên player qua `0x0d/0x001f→0x0020`,
  tên guild qua `0x24/0x0035→0x0036` (nhận đúng id dạng f4).
- **Owner guild của điểm = `f4`** (đã chốt, xem bảng).

## 5. Packet flow khi thao tác trong mỏ (capture `run-mine-detail-1`, có mark từng click)

| Thao tác                      | Packet phát sinh                                                                                                                                                                                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Login**                     | `0x48/0x0001→0002` (map state) + `0x48/0x0013→0014` (season) + `0x48/0x001a→001b` (history) + brief `0x0d/0x001f` cho 6 id **quân đoàn** (51729833 = chủ guild HUNTERS…) — không phải người trong mỏ                                                                                                          |
| **Click guild icon**          | `0x13/0x0007` guild chat feed                                                                                                                                                                                                                                                                                 |
| **Click "Khai Thác Guild"**   | `0x48/0x0013→0014` refresh season — `f5`=start, `f4`=end (unix s), `f3`=packed list season tile id (513–544, encoding chưa chốt — xem [`BACKLOG_MINE.md`](BACKLOG_MINE.md) §3)                                                                                                                                |
| **Click nút Log (popup Lịch Sử)** | *(từ POC run-mine1, không phải capture của bảng này)* popup **TRỐNG** thì không sinh request (render từ state); khi **có entry** mới fetch `0x0d/0x001f` (packed = đúng các player id trong history feed) → `0x0020` briefs để render tên. Popup lọc sự kiện theo **map đang mở**                               |
| **Click vào mỏ (zoomin)**     | ① `0x48/0x0006` [4 tile id] → `0x0007` **chi tiết 4 điểm**: như login state + slot `f5` = đầy đủ chuỗi phiên đào ② `0x48/0x0015` [4 tile id] → `0x0016` **RỖNG (11B, no-op)** ③ `0x0d/0x001f` **59 id = toàn bộ người của 4 điểm** → `0x0020` 24KB tên ④ `0x0d/0x001f` lô 2 (11 id, nguồn chưa rõ) → `0x0020` |
| **Click minimap (overview)**  | `0x24/0x0035` theo **f4 từng điểm** [5170010, 5170010, 5140005, 5320011] → `0x0036` tên guild (HUNTERS/HUNTERS/OLYMPUS/LxVN). Expand ▼ **không sinh packet** — tên đã có sẵn                                                                                                                                  |
| **Click máy của player khác** | `0x0d/0x0019` {id} → `0x001a` **profile đầy đủ** (heroes, items, power…) + `0x24/0x0033` {f4 guild} → `0x0034` guild detail (tên, mô tả, chủ guild, power, log thành viên, cửa sổ season)                                                                                                                     |
| **Live (không click)**        | `0x13/0x0007` push event real-time (cùng cấu trúc entry với history replay: f7=150, f9=JSON args) + `0x48/0x0008` **push delta tile** khi có người vào/ra slot                                                                                                                                                |

**Hệ quả cho bot:**

- Tên player của cả mỏ fetch **một lần lúc zoomin**, không lazy theo điểm — nhưng nếu chỉ có login state
  (không click) thì KHÔNG có tên nào; bot phải tự bắn `0x0d/0x001f` theo id —
  `tools/socket_log/mine_socket/logger.py` đã làm sẵn (inject frame, 60 id/request, verify 195/195 người có tên 2026-10-23).
- **3 slot 9001–9003 của mỗi điểm = bộ claimer của guild chủ điểm**: 3 acc cùng 1 guild (rule game),
  guild đó = guild claim `f4` — xác minh được người claim ngay từ state; `tools/socket_log/mine_socket/report.py` đối chiếu
  cả 2 phía (đồng bộ giữa 3 claimer, và giữa claimer ↔ `f4`), vi phạm thì đưa vào `errors`.
- State mỏ tự cập nhật realtime qua `0x48/0x0008` + `0x48/0x0002` một phần — giữ session là có state tươi.
- **Quy tắc đã xác minh trên data:** 1 user chỉ chiếm đúng 1 slot (195 người = 195 slot, live check);
  mỗi điểm có 0 hoặc 1 guild claim (`f4`), điểm unclaimed vẫn có user ngồi bình thường (40/64 điểm
  unclaimed khi capture).

## 6. Listener — output stream (JSONL)

`tools/socket_log/mine_socket/logger.py` giữ session mở vô hạn, tự reload page khi game socket đứt, ghi thẳng
JSONL đã decode (không phải binary) dưới `.tmp/mine-events/`:

| File                  | Nội dung                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| `mine-events.jsonl`   | broadcast type 150: replay `0x13/0x0004` lúc login + live `0x13/0x0007`, dedupe theo event id        |
| `mine-state.jsonl`    | snapshot map lúc login `0x48/0x0002`, 1 dòng/tile — server cũng đẩy 0x0002 một phần giữa session      |
| `mine-tiles.jsonl`    | delta tile realtime `0x48/0x0008` (`--no-tiles` để tắt)                                               |
| `player-briefs.jsonl` | mọi `0x0d/0x0020` client nhận: id, tên, power, server, `f11` = {id guild, tên guild}                  |
| `guild-briefs.jsonl`  | `0x24/0x0036` — response không echo guild id, map qua `seq` của request `0x24/0x0035`                 |

Bước tổng hợp: `tools/socket_log/mine_socket/report.py` đọc 5 stream trên → rebuild world mới nhất (snapshot +
delta theo `logged_at`, snapshot ≥32 tile mới tính là full map) → `mine-report.json` + cây báo cáo.

## 7. Trạng thái & Backlog

- Toàn bộ open issues và các việc cần làm tiếp theo của nhánh Khai Thác Guild đã được hợp nhất theo dõi tập trung tại: [`BACKLOG_MINE.md`](BACKLOG_MINE.md).
- Các mốc cấu trúc world, layout 2x2, cơ chế claimer slot 9001–9003, guild claim `f4`, và nhận diện streak/debuff đã được xác minh xong và chốt tại các mục 1–5 ở trên.
