# SEA_PACKET_ANALYSE — Spec phân tích packet Tranh Bá Tứ Hải

> Mục tiêu phase: **liệt kê đủ node + lấy dữ liệu per-node bằng payload thẳng**, không
> giả lập zoom/pan/click trên map (last-worse solution). Mọi mục đã chứng minh xong bị
> drop khỏi danh sách việc; chỉ giữ NEED_CONFIRM.
>
> Nguồn dữ liệu: capture `.tmp/socket-capture/sea-20261024-100433` (634 frame, pre-war
> 2026-10-24) + config table client bóc từ bundle game (hướng dẫn §5). Framing chung xem
> `docs/sea/SOCKET_PROTOCOL.md`; cấu trúc nghiệp vụ xem `docs/sea/SEA_STRUCTURE.md`.

## 1. Kết quả chính (ĐÃ CHỨNG MINH — không cần làm lại)

### 1.1. List node đầy đủ KHÔNG cần click map

- Mở battle map (click tâm lobby) → client gửi `0x72/0x000b` (rỗng) → server đẩy
  **`0x72/0x000c` (~23KB) = full state map**:
  - `f2` repeated ×89 — **89 node, id 1..89**: `{f1: node id, f2: owner faction}`.
    Pre-war chỉ id 1..4 có owner (faction 1..4) — **id 1..4 = 4 base (skip đúng như
    chủ dự án nói)**, node thường = **5..89**.
  - `f3` ×4 — 4 phe: `{f1: faction id, f4: id chủ phe, f2: packed member ids}`.
  - `f4` ×115 — guild roster: `{f1: guild id (7 chữ số), f2: repeated player id}`.
  - Request tái sử dụng được: gửi thẳng `0x72/0x000b` bất kỳ lúc nào để re-sync map.
- → **Không zoom/pan nào là cần thiết để enumerate node.** List id = 5..89 lấy từ 1 frame.

### 1.2. Config table node = `CampGVGLO` (client, id trùng server id)

- Bảng config client có **89 row, `id` == server node id 1:1**, bóc được toàn bộ:
  `_name` = **"{display id}{tên}"** (vd `1-23Đảo Câu Cá`), `_type`, `_points`,
  `_pointRequire` (Điểm chiếm đóng tối thiểu), `_unlockTime` (day), `_monsterType`,
  `_occupyReward` / `_firstOccupyReward`.
- Phân loại theo `_type`: **1** = 4 phe/base (Vịnh Thao Thiết, Long Khư U Ám, Thần Tự
  Lấp Lánh, Thánh Đảo Lạnh Giá — khớp BXH), **2** = 24 đảo "1-x" (vành ngoài),
  **3** = 52 đảo "2-x" (vành trong), **4** = 8 "Khu nghỉ dưỡng 3-x", **5** = 1 trung tâm
  `4-1Khách Sạn Cực Lạc` (require 15M, unlock day 6).
- **Prefix display id trong `_name` khớp định danh `src/data/map-layout.ts`** đang trace
  (`1-23`, `2-41`, `3-1`, `4`) → join frontend ↔ game = nối thẳng, không cần suy đoán
  vị trí. Map hex `ghostWar/maps/map_ghost_01/02.bin` trong bundle KHÔNG phải map đảo
  (battlefield gameplay khác) — bỏ qua.
- Verify chéo capture: 10 cặp (WS id ↔ shot header) khớp CampGVG, trong đó cặp quyết
  định `n14: WS id 63 → "1-11Đảo Lều Trại"` == CampGVG id 63. Ba shot `7-n03/7-n04/
7-n13` lệch tên (Champagne/Nhà Gỗ/Lều Trại xoay vòng) là **artifact render popup lag**
  khi auto-click nhanh — KHÔNG phải mapping khác (bằng chứng: cùng id 63, n14 render
  đúng, f4 art-class của 63 = rabbit không thể là Champagne).

### 1.3. Request per-node bằng payload thẳng (thay click)

Client click đảo chỉ sinh các request sau — đều gửi được thủ công nếu hook được socket:

| Request       | Payload                   | Response      | Nội dung                                                                                            |
| ------------- | ------------------------- | ------------- | --------------------------------------------------------------------------------------------------- |
| `0x72/0x0011` | `{f1: node id}`           | `0x72/0x0012` | state node: `{f2: {f4: 1001..1009, f1: id, f2: 4×{f1: faction, f2: Điểm ST của phe tại node}, f3}}` |
| `0x72/0x003e` | `{f1: node id}`           | `0x72/0x003f` | `{f2: id, f1, f3, f4}` — toàn 0 pre-war (nghi locked/battle state)                                  |
| `0x0c/0x0002` | `{f1: 118, f2: node id}`  | `0x0c/0x0003` | node leaderboard; pre-war 32B (rỗng)                                                                |
| `0x0c/0x0002` | `{f1: 116 / 117, f2: 0}`  | `0x0c/0x0003` | BXH Phe / BXH điểm (331B, có data thật)                                                             |
| `0x0d/0x001f` | `{f1: packed player ids}` | `0x0d/0x0020` | id→tên player (POC xong ở event mỏ, tái dùng)                                                       |

- `f1: 118/116/117` = **board id**: 118 = per-node, 116 = BXH phe, 117 = BXH điểm.
- Kính lúp (boss detail) và các nút phụ trong popup **không sinh request** — render từ
  config client (xem NEED_CONFIRM 3).
- Cơ chế inject frame vào game socket đã POC ở event mỏ (`tools/socket_log/mine_socket/logger.py` hook
  `WebSocket.prototype.send` + `page.add_init_script`) — áp nguyên cho sea.

### 1.4. Flow crawl (đang chạy trong crawler)

1. Vào battle map bằng **payload entry** (wait-login + inject `0x72/0x000b`, 0
   click — xem [`EVENT_NAVIGATE_DECODE.md`](EVENT_NAVIGATE_DECODE.md)); GUI
   walkthrough chỉ còn là fallback `--gui-entry` → đọc `0x72/0x000c` → list id + owner.
2. Với mỗi id 5..89: inject `0x72/0x0011` + `0x0c/0x0002{118}` → thu detail + leaderboard.
3. Inject `0x0c/0x0002{116/117}` cho 2 BXH; `0x0d/0x001f` theo id player xuất hiện.
4. Sink JSONL tái dùng lõi `tools/socket_log/core/runner.py` (như mine) — re-crawl định kỳ khi war diễn ra.

### 1.5. Bảng nhiên liệu 4 phe + signal login (chốt 2026-10-29)

- `0x72/0x001b` (rỗng) → `0x001c` (~181B): repeated row/phe `{f1 id, f2 Tổng
  Nhiên Liệu (double), f3 chưa định danh, f4 rank, f5 packed đảo đang giữ}` —
  `f5` là nguồn owner compact thay việc parse `0x000c` 23KB; top-level `f3` =
  phe của account. Inject được từ Home ngay sau login (E1 PASS ×2, crawler
  dump ra `standings.json`) — chi tiết [`EVENT_NAVIGATE_DECODE.md`](EVENT_NAVIGATE_DECODE.md) §2.
- `0x72/0x0002` đầu tiên lúc boot = **signal login-done** (boot sync xong) —
  signal chờ của payload entry; heartbeat `0x02/0x0009` muộn hơn ~2.6s nên
  không dùng.
- Lưu ý parse: field `f4` "fight_cap" của `0x72/0x0025` cũng là nhiên liệu phe,
  không phải lực chiến (misnomer trong `parse_faction_detail`).

## 2. NEED_CONFIRM (việc mở — làm/xác nhận thì xóa dòng)

| #   | Vấn đề                                                                                                                                                                                | Trạng thái   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1   | **`f4` (1001..1009) trong `0x72/0x0012` là gì** — art/boss class (không khớp production tier: 1001 xuất hiện ở cả node 12/h lẫn 36/h). Đối chiếu với bảng boss/art khi có tên boss    | Cần decode   |
| 2   | **"Hiệu suất sản xuất 12/24/36/h" không nằm trong CampGVGLO** — chỉ thấy `_pointRequire` 2/4/6/10/15M tỉ lệ thuận. Tìm bảng nguồn (config còn lại) hoặc derive từ `_pointRequire`     | Cần decode   |
| 3   | **Boss detail** (tên "Tứ Hải-Oán Linh", trait, hero đề xuất): popup không sinh request → nguồn là config client. Ứng viên: `SkillBuffBossLO` (67 row) / `_monsterType`. Chưa map xong | Cần decode   |
| 4   | **`0x72/0x003e→0x003f` toàn 0 pre-war** — ý nghĩa 4 trường chỉ đọc được sau khai chiến. Capture lại sau 10/26 10:00                                                                   | Chờ war      |
| 5   | **Base ↔ hướng (north/east/south/west)**: CampGVG chỉ cho id 1..4 = 4 phe, không có toạ độ. Tự đối chiếu màu cờ trên `docs/assets/sea-socket/6-battle-map.png` khi build `src/`       | Tự đối chiếu |
| 6   | **War-time delta**: sau 10/26 10:00 capture lại xem `0x72/0x000c` push interval + `0x72/0x0012` khi node có chủ / có ST                                                               | Chờ war      |
| 7   | Server CN có cùng module không (open item chung của SOCKET_PROTOCOL)                                                                                                                  | Backlog      |

## 3. Deliverables của phase

- [ ] Crawl full 89 node (id, tên, display id, type, threshold, owner, Điểm ST theo phe)
      bằng flow §1.4 → JSON/JSONL thay mock `src/data/`.
- [ ] `src/data/map-layout.ts`: join CampGVG `_name` prefix ↔ layout id hiện có; bổ sung
      `gameId` (server id) + `_pointRequire` (claimThreshold thật) + tên thật.
- [x] Cập nhật `docs/sea/SOCKET_PROTOCOL.md` section sea (module 0x72/0x0c) — hoàn tất khi
      SOCKET_PROTOCOL tách thành doc dùng chung (§4.2 + §3.5).
- [ ] (Sau 10/26) Bổ sung dữ liệu động theo NEED_CONFIRM 4/6.

## 4. Bóc config client (hướng dẫn tái sử dụng)

Game = Cocos Creator 2.x, bundle trên cùng host. Trích CampGVGLO không cần login:

1. `manifest.<ClientVer>.js` (ClientVer trong `h5SB_4399_sea_vn.js`) → `main.<hash>.js`
   (loader) → code game nằm ở **`assets/main/index.<hash>.js` (~24MB, `window.__require`)**.
2. Config bảng nén **QuickLZ + stream custom (`StreamMgr.getVo`)**, nhưng KHÔNG cần tự
   parse: boot page headless (Chrome channel, không cần profile) → game tự tải
   `remoteConfig/sea/config.<ConfigVer>.bin` → `window.__require("CampGVGLO").CampGVGLO.store`.
3. Script mẫu đã chạy: lưu `/tmp/sea_lo_scan.py`, `/tmp/sea_camp_extract.py` (scan toàn bộ
   ~476 bảng LO + dump store). Output mẫu: `/tmp/sea-extract-campgvg.json`.
4. Chú ý version: hash bundle (`index.8dd7c.js`, `config.62613.bin`) đổi theo đợt deploy
   (`ConfigVer`/`ClientVer` trong `localConfig`) — luôn đọc lại manifest trước khi fetch cứng.

## 5. Phụ lục — evidence paths

- Capture run: `.tmp/socket-capture/sea-20261024-100433/` (index.jsonl + screens/).
- Node-open request samples: `#443 {08 3f}` = id 63 (n03), `#455 {08 47}` = id 71 (n04).
- Board request samples: `#379 {f1:116,f2:0}` (BXH phe), `#425 {f1:118,f2:8}` (node 8).
- Map state: frame `#415` `0x72/0x000c` 23132B (f2×89, f3×4, f4×115).
- Chi tiết điều hướng/coords màn hình: `docs/sea/2026-10-24-sea-capture.md`.
