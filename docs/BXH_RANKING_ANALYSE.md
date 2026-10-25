# BXH home (Ranking) — Phân Tích Packet (POC 2026-10-25)

> Câu hỏi gốc: **server gửi full leaderboard hay chỉ top 100, và gửi những gì?**
> Trả lời ngắn: **CHỈ TOP 100** (rank 1→100 liên tục) + **1 entry selfRank riêng**.
> Không có pagination — mở board 1 request duy nhất, scroll hết list 0 request.
> Capture: `.tmp/socket-capture/bxh-run7` (profile `.tmp/pdd`, acc OLLOFI id 51456219).
> Screens + step ảnh: `docs/bxh-POC/`; goldens expect: `tools/socket_log/goldens/bxh-*.png`.

## 1. Kết luận chính (đã verify bằng decode schema thật của game)

| Board | rankType | Entries | selfRank (pdd/OLLOFI) | So khớp UI |
| --- | --- | --- | --- | --- |
| BXH Ái | 8 | **100** (rank 1..100 liên tục) | rank 41, key 225 | podium 3a: 361/320/316ái ✓, pinned "41 … 225ái" ✓ |
| BXH Lực Chiến | 7 | **100** (rank 1..100 liên tục) | rank 48, key 3,543,687 | podium 3c: 80.24M/31.33M/23.67M ✓, pinned "48 … 3.54M" ✓ |

- `ranks` (f3) = repeated item, **key giảm đơn điệu, rank 1..100 liền kề không lỗ**.
- Entry shape: `{rank, key (double = điểm/power), rankId (player id), additionInfo, idType}`.
  Trong 2 board này `additionInfo` luôn rỗng `"{}"` (schema có sẵn cho board khác có extra data),
  `idType = 1` (= playerId, xem `RankingIdType_Ranking_Enum` trong bundle).
- `rankLength` (f5 của response, "tổng số hàng trong bảng xếp hạng") **không được server set** trong 2 capture.
- Player nằm ngoài top 100: chưa test trực tiếp (acc pdd đang trong top 100) — nhưng schema
  có `selfRank` riêng → nhiều khả năng server vẫn trả kèm rank của mình. NEED_CONFIRM.
- Briefs render tên đi kèm (`0x0d/0x001f→0x0020`) cũng **đúng 100 briefs** — server chỉ fetch
  name/fightCap/guild cho top 100, không rộng hơn.

## 2. Flow UI + protocol (mỗi board = 1 request)

Nhấn icon BXH trên home → menu 2 nút → chọn "BXH" → mở board mặc định BXH Ái (board 8);
nút trái-dưới màn BXH mở menu 3 board (Ái / Lực Chiến / Guild) → chọn "BXH Lực Chiến" (board 7).

```
click icon BXH (340,118)
  → S 0x0c/0x0002 body {f1: rankType=8, f2: rankSubType=0}      # 10B, mở BXH Ái
  ← R 0x0c/0x0003 (QuickLZ nén, 1106B wire → 2428B plain)        # 100 entries + selfRank
  → S 0x0d/0x001f GetBasePlayerInfos {f1: packed 100 playerIds}  # 409B
  ← R 0x0d/0x0020 GetBasePlayerInfosR (31594B, không nén)        # 100 briefs

click "BXH Lực Chiến" trong menu board (172,644)
  → S 0x0c/0x0002 body {f1: 7, f2: 0}                            # 10B
  ← R 0x0c/0x0003 (nén 1399B → plain ~2.4KB)                     # 100 entries + selfRank
  → S 0x0d/0x001f (packed ids)
  ← R 0x0d/0x0020 (32592B)                                       # 100 briefs
```

- **Scroll list (4 vòng × 10 wheel event) = 0 request** — client giữ nguyên data, render local.
  (scroll chậm: ~10 event chỉ nhích ~5 entry — list smooth-scroll, cần nhiều vòng nếu muốn cuộn tới đáy).
- Đổi board = request mới với rankType mới; không cache giữa các board.
- Tên trong list render từ briefs (như event mỏ/sea đã map — `0x0d` là nguồn id→tên).

## 3. Schema (bóc từ bundle `assets/main/index.8dd7c.js`)

Codec game = protobuf wire chuẩn + descriptor runtime (`RankingDefine`/`PlayerInfoDefine`/`GameDefDefine`),
decoder `BufferUtils.decode` + `PBReader`; response có thể nén **QuickLZ** trước khi decode.

### 3.1 `RankingType_Ranking_Enum` (bundle `RankingProto`) — rankType cho 0x0c/0x0002

| Giá trị | Tên bundle | Board UI |
| --- | --- | --- |
| 7 | RankingTypeFightCap | **BXH Lực Chiến** |
| 8 | RankingTypeAdventure | **BXH Ái** (board mặc định mở từ home) |
| 19 | RankingTypeGuild | BXH Guild (menu thứ 3, chưa capture — NEED_CONFIRM) |
| 116/117/118 | (sea event, xem `SOCKET_PROTOCOL.md` mục Sea) | BXH phe / BXH điểm / BXH node |

Các giá trị khác trong enum (1–6, 20–35, 38+): arena daily/weekly, cross-arena, climb tower,
team expedition, handbook, guild bath, WCS player/guild, royal vault… — cùng cơ chế
`GetCommonRank(rankType, rankSubType)` nhưng chưa cần cho mục đích hiện tại.

### 3.2 Request `GetCommonRank_Ranking_C2S` (0x0c/0x0002)

| Field | Tên | Type | Ghi chú |
| --- | --- | --- | --- |
| f1 | rankType | uint32 | 7 / 8 / 19… (bảng trên) |
| f2 | rankSubType | uint32 | 0 với BXH Ái/Lực Chiến; sea node dùng f2=node id (đã map ở SOCKET_PROTOCOL) |

### 3.3 Response `GetCommonRankR_Ranking_S2C` (0x0c/0x0003)

| Field | Tên | Type | Ghi chú |
| --- | --- | --- | --- |
| f1 | err | int64 | 0 = ok |
| f2 | selfRank | CommonRankItem | entry của chính mình (kể cả khi nằm ngoài list?) |
| f3 | ranks | repeated CommonRankItem | **chỉ top 100** |
| f4 | idType | uint32 | 1 = playerId |
| f5 | rankLength | uint32 | tổng số hàng — **server không gửi** trong capture này |

`CommonRankItem_Ranking_S2C`:

| Field | Tên | Type | Ý nghĩa |
| --- | --- | --- | --- |
| f1 | rank | uint32 | hạng 1..100 |
| f2 | key | double (Bit64) | giá trị xếp hạng: power (Lực Chiến) / điểm ái (BXH Ái) |
| f3 | rankId | uint32 | player id (tra tên qua `0x0d/0x001f`) |
| f4 | additionInfo | string (JSON) | `"{}"` rỗng ở cả 2 board (board khác có thể có extra) |
| f5 | idType | uint32 | 1 |

### 3.4 Briefs `GetBasePlayerInfos_PlayerInfo_C2S` (0x0d/0x001f) → `…R` (0x0d/0x0020)

- Request: `f1 = playerIds` repeated uint32 (packed) — client bắn đúng 100 id top-100.
- Response: `f1 err`, `f2 baseInfos` repeated `BaseInfo_GameDef_S2C`:

| Field | Tên | Type | Mẫu (run7) |
| --- | --- | --- | --- |
| f1 | playerId | int64 | 51618727 |
| f2 | name | string | "Cold" |
| f3 | offlineTime | int64 | unix giây |
| f4 | fightCap | uint64 | 9,720,091 |
| f5 | avatar | string | `head/head_role_014` HOẶC URL upload `https://static.joynetgame.com/...png` |
| f7 | level | int64 | 92 |
| f8 | vipLevel | int64 | 0 |
| f9 | serverId | int32 | 516 (thấy cả 515 — xem mục 5) |
| f10 | serverName | string | null trong capture |
| f11 | guild | GuildSimpleBaseInfo | {id?, name: "OneKing"} — id field chưa map đúng tên |
| f12 | frame | uint32 | 0/1/19… (khung avatar) |
| f13 | username | string | — |
| f14 | ext | string | — |
| f15 | platform | string | — |
| f16 | originalServerId | int32 | — |
| f17 | moduleBaseList | repeated ModuleBaseInfo | — |
| f19 | arenaScore | uint32 | — |
| f20 | sex | int32 | — |
| f21/f22 | cpId/cpQuality | int64 | (cp = cặp đôi?) |
| f23 | chatPopCode | uint32 | — |
| f24 | adventureLevel | uint32 | 265 |
| f25 | title | uint32 | 59 |
| f26 | derma | uint32 | (skin) |
| f27/f28 | masterId/masterName | | (người giới thiệu?) |

(Schema gốc còn f6/f18/f29+ chưa liệt kê đủ — dump đầy đủ trong bundle `GameDefDefine.BaseInfo_GameDef_S2C_Def`.)

## 4. 🚨 Sửa framing response (quan trọng cho mọi phân tích cũ)

`SocketMgr.onMessageParser` trong bundle phơi bày header response thật **8 byte**, không phải 7:

```
response = [len:2 BE][ssid:1][fragIdx:1][fragCount:1][module:1][cmd:2 BE][compress:1][body]
```

| Byte | Ý nghĩa thật | Trước đây hiểu nhầm là |
| --- | --- | --- |
| [2] | ssid — id phục vụ group/reassembly | seq |
| [3] | fragIdx (stt gói khi chia nhỏ) | "flags 01" |
| [4] | fragCount (>1 = gói rời, client sort theo fragIdx rồi ghép body) | "flags 01" |
| [7] | **compress flag**: 1 = body QuickLZ (decompress trước decode) | "status=00" |

- Mọi capture cũ chưa gặp fragCount>1 và compress=1 → kết luận cũ vẫn đứng, nhưng
  `socket_decode.py` sẽ **decode sai/hỏng mọi frame nén** (`0x0c/0x0003` là ví dụ đầu tiên).
- `0x0c/0x0003` là frame đầu tiên được server nén QuickLZ. QuickLZ dùng đúng module
  `QuickLZ.decompress` của game (đã chạy qua page runtime — xem §6).

## 5. Side findings (mining phụ — đáng ghi nhớ)

1. **BXH này là cross-server**: briefs có cả `serverId 515` lẫn `516` trong cùng top 100
   (516 mới hơn). Chat world cùng phiên có người nói "sẽ có **merge 8 server**"
   (tiếng Indonesia) — khớp client có sẵn cmd `GetMergeServerGroup` (module 13 cmd 37).
2. **Popup auto khi vào home** (mỗi acc, lặp lại mỗi login cho tới khi tick "Không nhắc lại hôm nay"):
   - Popup 1: **Sách Lưu Dày** (bật ~13s sau home render, tự stay). Checkbox tại (246,608);
     đóng bằng click nền (172,648).
   - Popup 2: **Tranh Bá Tứ Hải** (bật sau khi popup 1 được đóng, ~1–6s). Checkbox (311,690),
     đóng (172,648).
   - Tick "không nhắc hôm nay" (checkbox y≈608/690 tùy popup) → phiên login sau sạch popup.
3. **Tọa độ home dễ nhầm** (viewport 640×720): (172,644) = nút mở world chat khi KHÔNG có popup
   (run2/run5/run6 nổ vì cái này); (246,608) = nút "Khiêu chiến" → mở màn đánh; click (70,350)
   không đóng được popup (trúng icon mờ dưới overlay, bị nuốt).
4. BXH Ái server-side gọi `RankingTypeAdventure` (thám hiểm) — tên UI "Ái" không khớp tên
   server; giá trị key = điểm "ái" (tín hồng?). Top key ~316–361.
5. `offlineTime` một số entry ở **tương lai** so với wall-clock (vd 1,792,864,000 ≈ 2026-11-05
   khi capture 2026-10-25) — nghi server time skew hoặc field không phải "last logout".
   NEED_CONFIRM.
6. Avatar có 2 dạng: asset nội bộ (`head/...`) và **URL upload thật** trên
   `static.joynetgame.com` — người chơi được upload ảnh đại diện.
7. run7 so với ảnh step của user (chụp trước đó): top2 đổi từ OLAdam 21.61M → người khác
   31.33M, OLLOFI 47→48 — **BXH cập nhật realtime** giữa các phiên, mọi thứ tính lại theo
   power hiện tại.
8. Login push (đợt frame đầu sau connect) vẫn như cũ: `0x12/0x0021` (29KB) + `0x12/0x0023`
   (1.6KB) — module 0x12 chưa map (nghi friend/mail?) — việc mở BXH KHÔNG dùng data push này
   (request riêng 0x0c/0x0002).

## 6. Cách decode lại (reusable — tool đã commit)

Codec nằm trong bundle; decode = QuickLZ (nếu `compress=1`) → `BufferUtils.decode(class, PBReader)`
với descriptor gắn qua `class.getDefines = Xxx_Def`. Chạy bằng chính runtime game (headless
page, `window.__require`), không cần port codec sang Python:

```bash
# tách body khỏi frame (đúng header 8B) rồi decode leaderboard 0x0c/0x0003
uv run python tools/socket_log/game_proto_decode.py --cut .tmp/socket-capture/bxh-run7 321
uv run python tools/socket_log/game_proto_decode.py rank /tmp/f321-body.b64

# decode player briefs 0x0d/0x0020
uv run python tools/socket_log/game_proto_decode.py --cut .tmp/socket-capture/bxh-run7 323
uv run python tools/socket_log/game_proto_decode.py briefs /tmp/f323-body.b64
```

Tool: `tools/socket_log/game_proto_decode.py` (mode `rank` / `briefs`; thêm mode mới =
đăng ký thêm class+Def trong `DECODE_JS`). Nguyên lý hoạt động: gắn `getDefines` cho mọi
proto class có `*_Def` trong `GameDefDefine`/`RankingDefine`/`PlayerInfoDefine`, rồi decode
qua `BufferUtils`/`PBReader`/`QuickLZ` của game — decode đúng 100% như client.

## 7. NEED_CONFIRM / open items

- [ ] selfRank khi player **ngoài top 100** (acc hạng thấp thử board Lực Chiến).
- [ ] BXH Guild (board 19) — same schema? `additionInfo` có dữ liệu gì?
- [ ] `rankLength` bao giờ server mới gửi (hiện None); có board trả >100 không?
- [ ] Giải `offlineTime` tương-lai (mục 5.5) + `guild.id` (field name đúng).
- [ ] Map đủ enum sea (116/117/118) vào `RankingIdType`/subType — hiện map tay trong SOCKET_PROTOCOL.
- [ ] FragCount>1 (gói chia nhỏ) chưa gặp trên thực tế — logic reassembly đọc từ JS, chưa test.
