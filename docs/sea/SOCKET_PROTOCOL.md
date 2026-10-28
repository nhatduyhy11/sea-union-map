# Haunted Room — Giao Thức WebSocket Chung

> **Tài liệu tham chiếu tầng mạng WebSocket của game Haunted Room.**
> Nguồn: Reverse-engineer các phiên capture server VN (`https://hauntedroomvnh5.joynetgame.com/`).
> Công cụ dùng chung: `tools/socket_log/core/` (decode, runtime codec, runner) + `tools/socket_log/capture/`.
> Các sub-doc nghiệp vụ riêng:
> - **Khai Thác Guild (Khu Mỏ, module `0x48`):** [`docs/mine_docs/MINE_STRUCTURE.md`](../mine_docs/MINE_STRUCTURE.md) & [`docs/mine_docs/BACKLOG_MINE.md`](../mine_docs/BACKLOG_MINE.md).
> - **Tranh Bá Tứ Hải (Sea Union, module `0x72`):** [`docs/sea/SEA_PACKET_ANALYSE.md`](SEA_PACKET_ANALYSE.md) & [`docs/sea/SEA_STRUCTURE.md`](SEA_STRUCTURE.md).

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
- **Player Brief (`0x0d / 0x001f` → `0x0020`):**
  - Request `0x001f`: `f1` = packed player ids (client thường gom tối đa ~60 id/lần).
  - Response `0x0020`: danh sách hồ sơ rút gọn gồm `f1`=id, `f2`=tên, `f4`=power, `f9`=server, `f11`={id guild, tên guild} (bản đọc `f15`=server trước đây là sai).
  - **Schema thật từ bundle [2026-10-25]:** `GetBasePlayerInfos{,R}_PlayerInfo` + `BaseInfo_GameDef_S2C` — fields đầy đủ: name/offlineTime/fightCap/avatar URL/level/vip/serverId/guild/title/adventureLevel… Decode qua `uv run python tools/socket_log/core/runtime_codec.py briefs <body.b64>`.
  - **Cơ chế đã hoàn thiện:** Lớp `NameFetcher` ([`tools/socket_log/core/runner.py`](../../tools/socket_log/core/runner.py)) chủ động inject request này vào WebSocket game để resolve toàn bộ id sang tên tự động mà không cần click UI.
- **Player Full Profile (`0x0d / 0x0019` → `0x001a`):** Trả về đầy đủ tướng, trang bị, lực chiến khi bấm xem một người chơi cụ thể.

### 3.4. Tra cứu Thông tin Bang Hội (`module 0x24`)
- **Guild Brief (`0x24 / 0x0035` → `0x0036`):** Request `f1`=guild id; response `f3`={f2: tên bang, f10: số thành viên, f11: server...}. Lưu ý response không echo guild id, map qua `seq` của request.
- **Guild Detail (`0x24 / 0x0033` → `0x0034`):** Mô tả bang, id chủ bang, tổng lực chiến bang, lịch sử thành viên.

### 3.5. Bảng Xếp Hạng (`module 0x0c`)
- Request `0x0c / 0x0002` `{f1: board_id, f2: sub_id}` → response `0x0c / 0x0003` (QuickLZ compressed).
- Các bảng đã map:
  - `116`: BXH Phe (Tranh Bá Tứ Hải).
  - `117`: BXH Điểm Cá Nhân toàn server.
  - `118`: BXH đóng góp theo từng Cứ Điểm (node).
  - `0x1f / 0x0007`: Leaderboard PvP khu mỏ.

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
- Chi tiết luồng crawl, phân tích 89 cứ điểm, config `CampGVGLO` và live data adapter:
  👉 **Tài liệu packet:** [`docs/sea/SEA_PACKET_ANALYSE.md`](SEA_PACKET_ANALYSE.md)
  👉 **Tài liệu cấu trúc bản đồ & cứ điểm:** [`docs/sea/SEA_STRUCTURE.md`](SEA_STRUCTURE.md)
- Tóm tắt packet:
  - `0x72 / 0x000b` → `0x000c`: Snapshot toàn bộ 89 cứ điểm, 4 phe và 115 bang hội (guild roster).
  - `0x72 / 0x0011` → `0x0012`: Chi tiết 1 cứ điểm (điểm sát thương 4 phe, art boss).
  - `0x72 / 0x0024` → `0x0025`: Điểm số bang hội thuộc từng phe.
  - `0x72 / 0x003e` → `0x003f`: Trạng thái động cứ điểm trong thời gian chiến sự.

### 4.3. Đấu Bang Hội & Giao Tranh (`module 0x1f`, `0x65`)
- `0x1f / 0x0007` (push lúc login): Leaderboard PvP khu mỏ — entry = `{f2: rank, f3: score, f1: profile đầy đủ nhúng (power, skins, avatar, blob config f17)}` — *chưa map đủ*.
- `0x1f / 0x000a` → `0x000b`: Lịch sử khiêu chiến mỏ (push lúc login) — entry = `{f1: attacker, f2: defender, f3: ts, f5: battle id, f4: bên thắng (1=attacker, 2=defender), f7/f6: JSON '{"rKey","pKey"}' rating attacker/defender, f9: profile defender nhúng}`. Verify: HuAsura đánh OLNaji 2 lần đều `f4=2` (thua) — nguồn chéo xác nhận streak, xem [`mine_docs/2026-10-23-mine-streak-debuff-decode.md`](../mine_docs/2026-10-23-mine-streak-debuff-decode.md) §3.
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
│   ├── runner.py          # Shared Playwright session, NameFetcher inject, JsonlSink
│   └── runtime_codec.py   # Cocos runtime codec (QuickLZ + PBReader decode)
├── browser/               # Tiện ích Playwright: navigation, profile popup guards
├── capture/               # Bắt frame raw verbatim: capture.py
├── mine_socket/           # Nhánh Khai Thác Guild: logger.py, report.py, protocol.py
└── sea_socket/            # Nhánh Tranh Bá Tứ Hải: crawler.py, report.py, walkthrough.py
```

---

## 6. Đang mở (Open items tầng socket chung)

> *Lưu ý: Mọi open issue riêng của nhánh mỏ (action 1–12, template 28000, tile f6/f8/f9, streak/debuff parser) đã được chuyển về theo dõi tại [`docs/mine_docs/BACKLOG_MINE.md`](../mine_docs/BACKLOG_MINE.md).*

- [ ] **Kiểm tra server CN (`hauntheroesweb.acenetgame.com`):** Xác nhận framing header 8-byte và các module `0x02`, `0x13`, `0x0d`, `0x72` có hoạt động tương tự server VN hay không.
- [ ] **Session idle & Auto-refresh token:**
  - Token đăng nhập trong `localStorage` có hạn 28 ngày (`expires_in: 2419200`). Hiện tại bot dựa vào persistent profile Chrome để tái sử dụng token.
  - Cần kiểm chứng hành vi của server khi phiên chạy liên tục nhiều giờ (có kick AFK không khi vẫn có heartbeat `0x02/0x0008`).
  - Xây dựng cơ chế tự phát hiện session hết hạn để tái đăng nhập tự động khi chạy bot lâu dài.
- [ ] **Giải mã đầy đủ module `0x65` (Guild Battle):**
  - Khám phá đầy đủ schema của `0x65/0x0009` (kết quả giao tranh 3 tướng) và `0x65/0x000c` (stat thành viên tham chiến) khi dự án có nhu cầu làm bot/dashboard chiến bang.
