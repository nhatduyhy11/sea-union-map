# Haunted Room — Giao Thức WebSocket Chung

> **Tài liệu tham chiếu tầng mạng WebSocket của game Haunted Room.**
> Nguồn: Reverse-engineer các phiên capture server VN (`https://hauntedroomvnh5.joynetgame.com/`).
> Công cụ dùng chung: `tools/socket_log/core/` (decode, runtime codec, runner) + `tools/socket_log/capture/` (ghi frame WS) + `tools/socket_log/gui/` (step DSL click/golden).
> Các sub-doc nghiệp vụ riêng:
> - **Khai Thác Guild (Khu Mỏ, module `0x48`):** [`docs/mine_docs/MINE_STRUCTURE.md`](../mine_docs/MINE_STRUCTURE.md) & [`docs/mine_docs/BACKLOG_MINE.md`](../mine_docs/BACKLOG_MINE.md).
> - **Tranh Bá Tứ Hải (Sea Union, module `0x72`):** [`docs/sea/SEA_STRUCTURE.md`](SEA_STRUCTURE.md) (packet tóm tắt ở §4.2 doc này).

---

## 1. Tổng quan kết nối

- Game H5 chạy hoàn toàn trong browser, **chỉ dùng WebSocket** (không WASM, không REST gameplay).
- **Game socket chính:** `wss://mg-sea-entry.bighost.games/ws?nodeName=wgamed&threadId=5&platform=singapore_online`
- **Handshake / redirect socket:** `wss://mg-sea-entry.bighost.games:19005/` (socket phụ này đóng thường xuyên là hành vi bình thường của game, không phải mất kết nối).
- **Đặc trưng State Push:** Toàn bộ state game được server chủ động push ngay sau khi login hoàn tất (khoảng 5.3–8.4s, tổng ~200KB). Mở nhiều popup in-game không sinh thêm request mà render trực tiếp từ client memory.

---

## 2. Framing (Đóng gói gói tin)

```
request  = [len:2 BE][module:1][cmd:2 BE][seq:1][protobuf body]
response = [len:2 BE][ssid:1][fragIdx:1][fragCount:1][module:1][cmd:2 BE][compress:1][body]
```

- **Quy tắc Request / Response:**
  - `response.cmd = request.cmd + 1`.
  - `response.ssid = request.seq` của request tương ứng (echo lại seq).
- **Header Response 8 byte (đã xác minh từ bundle `SocketMgr.onMessageParser`):**
  - `byte[0..1]`: `len:2 BE` (độ dài toàn bộ phần còn lại).
  - `byte[2]`: `ssid:1` (echo seq).
  - `byte[3]`: `fragIdx:1` (chỉ số phân mảnh).
  - `byte[4]`: `fragCount:1` (>1 là gói rời phân mảnh, client ghép theo `fragIdx`).
  - `byte[5]`: `module:1`.
  - `byte[6..7]`: `cmd:2 BE`.
  - `byte[8]` (tương ứng `body[6]` sau khi bóc len): **`compress flag`**: `1` = body nén thuật toán **QuickLZ**, `0` = protobuf thuần.
- **Protobuf wire format:** Body là protobuf wire format chuẩn không có schema tĩnh `.proto` (client decode bằng descriptor sinh sẵn trong JS bundle).
- **Tên message/field thật** có sẵn trong bundle — cách tra (proto, config `*LO`, trace UI → data): [`docs/research/BUNDLE_RESEARCH.md`](../research/BUNDLE_RESEARCH.md) (chỉ cần khi decode thứ mới).
- **Decode Runtime:** Với các frame nén hoặc cấu trúc phức tạp (như BXH `0x0c`), công cụ giải mã trực tiếp qua headless browser gắn `window.__require` của chính game: [`tools/socket_log/core/runtime_codec.py`](../../tools/socket_log/core/runtime_codec.py).

---

## 3. Các Dịch Vụ Dùng Chung (Shared Services)

### 3.1. Heartbeat & Time Sync (`module 0x02`)
- Định kỳ client gửi mỗi ~5s: `0x02 / 0x0008` ↔ response `0x0009` (chứa unix server time varint).
- Khi tab browser mở, game client tự động duy trì nhịp heartbeat này.

### 3.2. Broadcast Bus (`module 0x13`)
- Client đăng ký kênh broadcast lúc login: `0x10 / 0x0008` (danh sách kênh packed).
- **Replay lịch sử lúc login:** `0x13 / 0x0004` đẩy hàng loạt tin nhắn thế giới, thông báo hệ thống và sự kiện.
- **Kênh Live Push:** `0x13 / 0x0007` đẩy sự kiện real-time (chat guild, biến động mỏ type 150...).
- Entry cấu trúc protobuf: `f1`=msg id, `f2`=channel (1: world, 2: system), `f3`=timestamp UTC, `f7`=type (150: mỏ...), `f9`=JSON template args.
- **`pos` trong JSON args** = `map*1000 + tile` (vd `5047` = map 5 / Mỏ Đá Cháy, tile 47; `6053` = map 6) — khác với tile state `f1` là id tĩnh trong bảng server (xem [`mine_docs/MINE_STRUCTURE.md`](../mine_docs/MINE_STRUCTURE.md) §1).

### 3.3. Tra cứu Tên & Hồ sơ Player (`module 0x0d`)
- **Player Brief (`0x0d / 0x001f` `GetBasePlayerInfos` → `0x0020` `GetBasePlayerInfosR`):**
  - Request `0x001f`: `1 playerIds` = packed player ids (client thường gom tối đa ~60 id/lần).
  - Response `0x0020`: danh sách hồ sơ rút gọn gồm `f1`=id, `f2`=tên, `f4`=power, `f9`=server, `f11`={id guild, tên guild} (bản đọc `f15`=server trước đây là sai).
  - **Schema thật từ bundle [2026-10-25]:** `GetBasePlayerInfos{,R}_PlayerInfo` + `BaseInfo_GameDef_S2C` — fields đầy đủ: name/offlineTime/fightCap/avatar URL/level/vip/serverId/guild/title/adventureLevel… Decode qua `uv run python tools/socket_log/core/runtime_codec.py briefs <body.b64>`.
  - **Cơ chế đã hoàn thiện:** Lớp `NameService` ([`tools/socket_log/core/names.py`](../../tools/socket_log/core/names.py)) chủ động inject request này vào WebSocket game để resolve toàn bộ id sang tên tự động mà không cần click UI.
- **Player Full Profile (`0x0d / 0x0019` → `0x001a`):** Trả về đầy đủ tướng, trang bị, lực chiến khi bấm xem một người chơi cụ thể.

### 3.4. Tra cứu Thông tin Bang Hội (`module 0x24`)
- **Guild Brief (`0x24 / 0x0035` → `0x0036`):** Request `f1`=guild id; response `f3`={f1: guild id, f2: tên bang, f3: mô tả, f8: leader id, f10: số thành viên, f11: server, f16: **tổng lực chiến guild**...}. Guild id có echo ở `f3.f1` (code hiện vẫn map qua `seq` của request).
- **Guild Detail (`0x24 / 0x0033` → `0x0034`):** Mô tả bang, id chủ bang, tổng lực chiến bang, lịch sử thành viên.

### 3.5. Bảng Xếp Hạng (`module 0x0c`)
- Request `0x0c / 0x0002` `GetCommonRank {1 rankType, 2 rankSubType}` → response `0x0c / 0x0003` `GetCommonRankR {1 err, 2 selfRank, 3 ranks, 4 idType, 5 rankLength}` (QuickLZ compressed).
- Row `CommonRankItem {1 rank, 2 key (điểm, double), 3 rankId (player/phe id), 4 additionInfo (JSON string), 5 idType}`.
- Các bảng đã map (`rankType` = board id):
  - `116` (`rankSubType 0`): BXH Phe (Tranh Bá Tứ Hải).
  - `117` (`rankSubType 0`): BXH Điểm Cá Nhân toàn server — top-200.
  - `118` (`rankSubType = cityId`): BXH đóng góp theo từng Cứ Điểm (node) — **top-20/node, gộp mọi phe**.
  - `0x1f / 0x0007`: Leaderboard PvP khu mỏ.
- **Top-20 của board 118 là do server cắt, không phải client** (verify 2026-10-30):
  crawler lưu nguyên body response rồi decode hết mảng `ranks`, không giới hạn số row;
  cùng decoder trả đủ 200 row cho board 117, còn mọi board 118 tối đa 20 row. Request
  không có tham số phân trang → không lấy thêm được. Hệ quả: Σ row của node thấp hơn
  `campHurtScores` (§4.2) ở node có trên 20 người chơi, và một phe có thể có điểm tại
  node nhưng 0 row (node 14: phe 2 có 12.473 điểm, 0 row).

---

## 4. Các Module Nghiệp Vụ Riêng

### 4.1. Khai Thác Guild / Khu Mỏ (`module 0x48`)
- Toàn bộ chi tiết cấu trúc world 65 tile, 1084 slot, 7 sector, cơ chế 3 claimer và phân tích field đã được tách riêng sang:
  👉 **Tài liệu nghiệp vụ:** [`docs/mine_docs/MINE_STRUCTURE.md`](../mine_docs/MINE_STRUCTURE.md)
  👉 **Danh sách việc tồn đọng nhánh mỏ:** [`docs/mine_docs/BACKLOG_MINE.md`](../mine_docs/BACKLOG_MINE.md)
- Tóm tắt packet:
  - `0x48 / 0x0001` → `0x0002`: Map snapshot toàn bộ 65 tile khi login.
  - `0x48 / 0x0006` → `0x0007`: Chi tiết 4 điểm mỏ khi click zoom-in (kèm slot `f5` chuỗi phiên đào).
  - `0x48 / 0x0008`: Server push delta cập nhật realtime khi có người vào/ra slot.
  - `0x48 / 0x0013` → `0x0014`: Season khai thác — `f5`=start, `f4`=end (unix s), `f3`=packed list season tile id (513–544, encoding chưa chốt — xem [`mine_docs/BACKLOG_MINE.md`](../mine_docs/BACKLOG_MINE.md) §3).
  - `0x48 / 0x0015` → `0x0016`: Response rỗng (no-op/legacy).
  - `0x48 / 0x001a` → `0x001b`: Feed lịch sử phụ khu mỏ — entry = `{f1: type, f2: JSON string}`; type 4 = `[player_id, pos, action, ts]` (action 9001/9002/9003), type 1 = `[pos, slot_no, ts]` (nghi log cá nhân acc — xem [`mine_docs/BACKLOG_MINE.md`](../mine_docs/BACKLOG_MINE.md) §4).

### 4.2. Tranh Bá Tứ Hải / Sea Union (`module 0x72`)
- Tài liệu nghiệp vụ:
  👉 **Tài liệu cấu trúc bản đồ & cứ điểm, config `CampGVGLO` + boss:** [`docs/sea/SEA_STRUCTURE.md`](SEA_STRUCTURE.md)
  👉 **Thí nghiệm payload entry (bỏ entry GUI) + quy trình tìm key cho event khác:** [`research/2026-10-29-event-navigate-experiment.md`](../research/2026-10-29-event-navigate-experiment.md)
- **Boot sync (luôn có lúc login):** client gửi block request rỗng `0x0001` GetOutInfo, `0x0006` GetPlayerInfo, `0x0020` GetLogInfo, `0x0033` GetCampStrategy, `0x0036` GetNotice → response `0x0002`, `0x0007`, `0x0021`, `0x0034`, `0x0037`. `0x0007` GetPlayerInfoR = `{playerId, power (thể lực event), buyPowerNum}`.
- **Request key của transition** (request rỗng, inject được từ Home ngay sau login — crawler payload entry dùng đúng 2 key này):
  - Click banner vào sea lobby → **`0x001b`** GetCampsProduct → `0x001c`. `0x0036` cùng gửi nhưng thuộc boot block, không kéo `0x001c`.
  - Click tâm map vào battlefield → **`0x000b`** GetMapInfos → `0x000c` (+ `0x0013` EnterScene → `0x0014 {err:0}` chỉ kích push `0x0019`, không cần). `0x0006` cùng gửi nhưng thuộc boot block.
- Tóm tắt packet:
  - `0x72 / 0x0002` `GetOutInfoR` (response lúc boot): `{isOpen, serverList, startDt, endDt, state, isQualified}` — block đầu chốt boot sync, signal login-done của payload entry.
  - `0x72 / 0x000b` `GetMapInfos` → `0x000c` `GetMapInfosR`: Snapshot 89 cứ điểm (`cityInfos {cityId, occupyCamp}`), 4 phe (`campInfos {campId, guildIds, score, presidentId, vicePresidentId}`), 115 bang hội (`guildInfos {guildId, memberInfos}`), `campId` của account, `markCityIds`. `cityId` 1..89 trùng id config `CampGVGLO` ([`SEA_STRUCTURE.md`](SEA_STRUCTURE.md) §4.1): **1..4 = base 4 phe**, node thường = **5..89** → enumerate đủ node từ 1 frame, không cần zoom/pan map. Gửi lại `0x000b` bất kỳ lúc nào để re-sync.
  - `0x72 / 0x0011` `GetCityInfo {cityId}` → `0x0012` `GetCityInfoR`: `CityInfo {cityId, campHurtScores (Điểm ST 4 phe), occupyCamp, monsterId (boss → `CampGVGMonsterLO`), campScores}` + top-level f3 `occupyRewardCampId`. Đo 9 crawl 2026-10-29/30 (cụm 517, 590):
    - `occupyCamp` trùng owner `0x000c` ở mọi node; `campScores` luôn rỗng.
    - `occupyRewardCampId` = **phe chiếm node lần đầu**: 0 ở base và node chưa từng có chủ; gán khi node bị chiếm lần đầu, giữ nguyên khi node đổi chủ (kể cả đổi qua lại) hoặc mất về trung lập. Parser `parse_node_state` chưa đọc field này.
  - `0x72 / 0x001b` `GetCampsProduct` → `0x001c` `GetCampsProductR`: Bảng nhiên liệu 4 phe — `CampProductScore {campId, score (nhiên liệu), efficiency, rank, cityIds}`, inject được ngay sau login. Push cùng shape: `0x0019` `UpdateCampScoreP`. Crawler ghi `standings.json`; `report.py` dump cho FE qua key `fuel` (campId → nhiên liệu).
  - `0x72 / 0x0024` `GetCampInfos {campId}` → `0x0025`: `CampDetailInfo {guildScoreInfos {guildId, hurtScore}, cityNum, score, rank}`. Field 4 `score` là nhiên liệu phe, không phải lực chiến — `parse_faction_detail` (`tools/socket_log/sea_socket/protocol.py`) đang đặt key cho field này là `fight_cap`.
  - `0x72 / 0x003e` `GetSweepInfo {cityId}` → `0x003f`: `{cityId, myTotalOutput, hurtScore}` — điểm của **chính account** tại cứ điểm (không phải state chung) → toàn 0 khi acc chưa đánh node đó.

### 4.3. Đấu Bang Hội & Giao Tranh (`module 0x1f`, `0x65`)
- `0x1f / 0x0007` (push lúc login): Leaderboard PvP khu mỏ — entry = `{f2: rank, f3: score, f1: profile đầy đủ nhúng (power, skins, avatar, blob config f17)}` — *chưa map đủ*.
- `0x1f / 0x000a` → `0x000b`: Lịch sử khiêu chiến mỏ (push lúc login) — entry = `{f1: attacker, f2: defender, f3: ts, f5: battle id, f4: bên thắng (1=attacker, 2=defender), f7/f6: JSON '{"rKey","pKey"}' rating attacker/defender, f9: profile defender nhúng}`. Verify: HuAsura đánh OLNaji 2 lần đều `f4=2` (thua) — nguồn chéo xác nhận streak, xem [`research/2026-10-23-mine-streak-debuff-decode.md`](../research/2026-10-23-mine-streak-debuff-decode.md) §3.
- `0x65 / 0x0009`: Summary lượt đánh nhóm 3 tướng — nhóm 3 fighter `{f1: id, f3: cờ thắng, f2: ?}` + `f3` = id winner — *chưa map đầy đủ*.
- `0x65 / 0x000c`: Danh sách bang tham chiến — list guild `{f4: id chủ guild, f3 repeated: {f1: id thành viên, f2–f6: stat}}` — *chưa map đầy đủ*.

---

## 5. Kiến Trúc Bộ Công Cụ (`tools/socket_log/`)

Bộ công cụ thu thập và phân tích WebSocket được tách thành các tầng độc lập:

```
tools/socket_log/
├── core/                  # Dùng chung: framing, proto decode, runtime codec, runner, args
│   ├── decode.py          # Pure proto parser & split_frame
│   ├── protocol.py        # Shared protocol: broadcast, player/guild brief builders
│   ├── names.py           # NameService: inject brief request, log player/guild briefs
│   ├── runner.py          # Shared Playwright session, WS hookup, run modes
│   ├── sinks.py           # JsonlSink
│   └── runtime_codec.py   # Cocos runtime codec (QuickLZ + PBReader decode)
├── browser/               # Tiện ích Playwright: navigation, profile popup guards, ws_inject (JS hook inject frame)
├── capture/               # Bắt frame raw verbatim: capture.py
├── mine_socket/           # Nhánh Khai Thác Guild: logger.py, report.py, protocol.py
├── sea_socket/            # Nhánh Tranh Bá Tứ Hải: crawler.py, brief_backfill.py, report.py, walkthrough.py
│   └── crawl/             # Engine inject online: router, board_codec, briefs, phases
├── config_extract.py      # Dump bảng config *LO (headless)
└── research/              # Tool đào local, ngoài flow chính: proto_extract.py
```

---

## 6. Đang mở (Open items tầng socket chung)

> *Lưu ý: Mọi open issue riêng của nhánh mỏ (action 1–12, template 28000, tile f6/f8/f9, streak/debuff parser) đã được chuyển về theo dõi tại [`docs/mine_docs/BACKLOG_MINE.md`](../mine_docs/BACKLOG_MINE.md).*

- [ ] **Session idle & Auto-refresh token:**
  - Token đăng nhập trong `localStorage` có hạn 28 ngày (`expires_in: 2419200`). Hiện tại bot dựa vào persistent profile Chrome để tái sử dụng token.
  - Cần kiểm chứng hành vi của server khi phiên chạy liên tục nhiều giờ (có kick AFK không khi vẫn có heartbeat `0x02/0x0008`).
  - Xây dựng cơ chế tự phát hiện session hết hạn để tái đăng nhập tự động khi chạy bot lâu dài.
- [ ] **Giải mã đầy đủ module `0x65` (Guild Battle):**
  - Khám phá đầy đủ schema của `0x65/0x0009` (kết quả giao tranh 3 tướng) và `0x65/0x000c` (stat thành viên tham chiến) khi dự án có nhu cầu làm bot/dashboard chiến bang.
