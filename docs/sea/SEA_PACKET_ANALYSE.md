# SEA_PACKET_ANALYSE — Spec phân tích packet Tranh Bá Tứ Hải

> Mục tiêu phase: **liệt kê đủ node + lấy dữ liệu per-node bằng payload thẳng**, không
> giả lập zoom/pan/click trên map (last-worse solution). Mọi mục đã chứng minh xong bị
> drop khỏi danh sách việc; chỉ giữ NEED_CONFIRM.
>
> Nguồn dữ liệu: capture walkthrough 634 frame (pre-war 2026-10-24) + config table client bóc từ bundle game. Framing chung xem
> `docs/sea/SOCKET_PROTOCOL.md`; cấu trúc nghiệp vụ xem `docs/sea/SEA_STRUCTURE.md`.
> Tên message/field lấy từ schema proto trong bundle [2026-10-29]. Cách đào bundle,
> config, proto + manh mối chưa đào: [`../research/BUNDLE_RESEARCH.md`](../research/BUNDLE_RESEARCH.md)
> (chỉ cần khi decode thứ mới).

## 1. Kết quả chính (ĐÃ CHỨNG MINH — không cần làm lại)

### 1.1. List node đầy đủ KHÔNG cần click map

- Mở battle map (click tâm lobby) → client gửi `0x72/0x000b` `GetMapInfos` (rỗng) →
  server trả **`0x72/0x000c` `GetMapInfosR` (~23KB) = full state map**:
  - `2 cityInfos` ×89 `CitySimpleInfo {1 cityId, 2 occupyCamp}` — **89 node, id
    1..89**. Pre-war chỉ id 1..4 có owner (faction 1..4) — **id 1..4 = 4 base (skip
    đúng như chủ dự án nói)**, node thường = **5..89**.
  - `3 campInfos` ×4 `CampInfo {1 campId, 2 guildIds (packed), 3 score (double),
    4 presidentId, 5 vicePresidentId}` — `f2` là **guild id** của phe, không phải
    member id như bản đọc cũ.
  - `4 guildInfos` ×115 `GuildInfo {1 guildId, 2 memberInfos: {1 playerId,
    2 hurtScore}}` — guild roster; `hurtScore` không thấy trong crawl 10/29 (= 0,
    proto bỏ field mặc định).
  - `5 campId` = phe của account đang crawl; `6 markCityIds` = đảo phe đánh dấu.
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
- Verify chéo capture: 10 cặp (WS id ↔ shot header) khớp CampGVG, vd `WS id 63 →
  "1-11Đảo Lều Trại"` == CampGVG id 63 (3 shot lệch tên = artifact popup render lag
  khi auto-click nhanh, request id vẫn đúng).
- **Hiệu suất sản xuất** (popup node "12/h") = `_points` điểm mỗi `_interval` phút:
  type 2 `1/5` = **12/h** (4M-require: `2/5` = 24/h), type 3 `4/10`·`6/10` =
  **24/36/h**, type 4 `15/15` = **60/h**, type 5 `30/15` = **120/h**.
- **`_monsterType`** `[[lo,hi,group],…]` = nhóm boss theo khoảng (nghi open-day
  server); `group` == `CampGVGMonsterLO._type`: group 1 = pool random 1001..1007,
  group 2..7 = boss cố định 1008..1013 (§1.6).

### 1.3. Request per-node bằng payload thẳng (thay click)

Client click đảo chỉ sinh các request sau — đều gửi được thủ công nếu hook được socket:

| Request                          | Payload                          | Response                          | Nội dung                                                                                                                                                                                 |
| -------------------------------- | -------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0x72/0x0011` `GetCityInfo`      | `{1 cityId}`                     | `0x72/0x0012` `GetCityInfoR`      | `{1 err, 2 cityInfo: CityInfo {1 cityId, 2 campHurtScores: map<campId, Điểm ST>, 3 occupyCamp, 4 monsterId, 5 campScores: map<campId, double>}, 3 occupyRewardCampId}` |
| `0x72/0x003e` `GetSweepInfo`     | `{1 cityId}`                     | `0x72/0x003f` `GetSweepInfoR`     | `{1 err, 2 cityId, 3 myTotalOutput (double), 4 hurtScore}` — **của chính account crawl** (càn quét), không phải state node → toàn 0 khi acc chưa đánh node đó                            |
| `0x0c/0x0002` `GetCommonRank`    | `{1 rankType: 118, 2 rankSubType: cityId}` | `0x0c/0x0003` `GetCommonRankR` | node leaderboard; pre-war 32B (rỗng). **Server chỉ trả top-20/node, gộp mọi phe**, request không có tham số phân trang (xem ghi chú dưới bảng) |
| `0x0c/0x0002` `GetCommonRank`    | `{1 rankType: 116 / 117, 2 rankSubType: 0}` | `0x0c/0x0003` `GetCommonRankR` | BXH Phe / BXH điểm (331B, có data thật)                                                                                                                                 |
| `0x0d/0x001f` `GetBasePlayerInfos` | `{1 playerIds (packed)}`       | `0x0d/0x0020` `GetBasePlayerInfosR` | `{1 err, 2 baseInfos: BaseInfo_GameDef}` id→tên player (POC xong ở event mỏ, tái dùng)                                                                                                |

- **Top-20 của board 118 là do server cắt, không phải client** (verify 2026-10-30):
  crawler lưu nguyên body response của server rồi decode hết mảng `ranks`, không
  giới hạn số row. Cùng
  decoder đó trả đủ 200 row cho board 117, còn mọi board 118 đều tối đa 20 row. Vì vậy
  Σ row của node thấp hơn `campHurtScores` ở node có trên 20 người chơi. Có thể một phe
  có điểm tại node nhưng không có row nào, vì 20 row đã bị phe khác chiếm hết (node 14:
  phe 2 có 12.473 điểm, 0 row). Không lấy thêm được → chấp nhận lệch (intent §5).
- `rankType 118/116/117` = **board id**: 118 = per-node, 116 = BXH phe, 117 = BXH điểm.
  `GetCommonRankR {1 err, 2 selfRank, 3 ranks, 4 idType, 5 rankLength}`, mỗi row
  `CommonRankItem {1 rank, 2 key (điểm, double), 3 rankId (player/phe id),
  4 additionInfo (JSON string), 5 idType}`.
- Kính lúp (boss detail) và các nút phụ trong popup **không sinh request** — render từ
  config client theo `monsterId` (§1.6).
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

- `0x72/0x001b` `GetCampsProduct` (rỗng) → `0x001c` `GetCampsProductR` (~181B):
  `2 camps` ×4 `CampProductScore {1 campId, 2 score (Tổng Nhiên Liệu, double),
  3 efficiency (double — hiệu suất sản xuất của phe), 4 rank, 5 cityIds (packed
  đảo đang giữ)}` — `cityIds` là nguồn owner compact thay việc parse `0x000c` 23KB;
  top-level `3 campId` = phe của account. Push cùng shape: `0x0019`
  `UpdateCampScoreP`. Inject được từ Home ngay sau login (E1 PASS ×2, crawler
  dump ra `standings.json`) — chi tiết [`EVENT_NAVIGATE_DECODE.md`](EVENT_NAVIGATE_DECODE.md) §2.
- `0x72/0x0002` đầu tiên lúc boot = **signal login-done** (boot sync xong) —
  signal chờ của payload entry; heartbeat `0x02/0x0009` muộn hơn ~2.6s nên
  không dùng.
- `0x72/0x0024` `GetCampInfos {1 campId}` → `0x0025` `GetCampInfosR {2 campDetailInfo:
  CampDetailInfo {1 campId, 2 guildScoreInfos: {guildId, hurtScore}, 3 cityNum,
  4 score, 5 rank}}` — field `f4` mà `parse_faction_detail` đặt tên "fight_cap"
  thực ra là **`score`** (nhiên liệu phe), không phải lực chiến.

### 1.6. Boss node = `monsterId` → `CampGVGMonsterLO` (chốt 2026-10-29)

- `CityInfo.4 monsterId` (doc cũ gọi "art", 1001..1013) là id boss →
  `CampGVGMonsterLO.get(id)` (tên) → `.showBoss` → `CreepLO` (avatar, mô tả, hero đề
  xuất). Verify: node 8 (1-23) `monsterId 1001` = "Tứ Hải-Oán Linh" khớp shot
  `9-boss-node.png`.
- `CampGVGMonsterLO` 13 row: 1001 Oán Linh, 1002 Nữ Hoàng Alien, 1003 Vô Diện Giả,
  1004 Pharaoh Cổ Đại, 1005 Thỏ Cưa Máy, 1006 Bọ Cạp Hoàng Tuyền, 1007 Khỉ Điên Đánh
  Trống (pool `_type` 1), 1008 Vô Diện Tử Thần, 1009 Hắc Trảo, 1010 Hắc Nữ Tăng Ca,
  1011 Cổ Thần, 1012 Kỵ Sĩ Không Đầu, 1013 U Ảnh Phu Nhân (tên đều có tiền tố
  "Tứ Hải-"). `_limitTime` 180s, `_battleGroundCode` 131001..131013.

## 2. NEED_CONFIRM (việc mở — làm/xác nhận thì xóa dòng)

| #   | Vấn đề                                                                                                                                                                                | Trạng thái   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 5   | **Base ↔ hướng (north/east/south/west)**: CampGVG chỉ cho id 1..4 = 4 phe, không có toạ độ. Tự đối chiếu màu cờ trên `docs/assets/sea-socket/6-battle-map.png` khi build `src/`       | Tự đối chiếu |
| 6   | **War-time delta**: sau 10/26 10:00 capture lại xem `0x72/0x000c` push interval + `0x72/0x0012` khi node có chủ / có ST                                                               | Chờ war      |
| 7   | Server CN có cùng module không (open item chung của SOCKET_PROTOCOL)                                                                                                                  | Backlog      |

## 3. Deliverables của phase

- [ ] (Sau 10/26) Bổ sung dữ liệu động theo NEED_CONFIRM 6.
- [ ] Đưa `monsterId` (node-states) + bảng `CampGVGMonsterLO` vào dump → UI hiện tên
      boss thật + hiệu suất sản xuất (`_points/_interval`).

## 4. Phụ lục — evidence paths

- Node-open request samples: `{08 3f}` = id 63 (n03), `{08 47}` = id 71 (n04).
- Board request samples: `{f1:116,f2:0}` (BXH phe), `{f1:118,f2:8}` (node 8).
- Map state: `0x72/0x000c` 23132B (f2×89, f3×4, f4×115).