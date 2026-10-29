# Sea capture POC — walkthrough chạy thành công + phân tích frame (2026-10-24)

> **Nhật ký research (lịch sử, không cập nhật).** Tên tool/đường dẫn và cách gọi field
> `fN`/"art" ở đây là của thời điểm ghi — kết quả đã chốt và tên field thật xem
> [`../sea/SEA_PACKET_ANALYSE.md`](../sea/SEA_PACKET_ANALYSE.md); throttle / pool dao
> động / top-K xem [`../sea/STATS_MISMATCH.md`](../sea/STATS_MISMATCH.md).

> Run chuẩn: `.tmp/socket-capture/sea-20261024-100433` — 8/8 stage, 634 frame, toàn bộ
> shot theo `docs/sea/SEA_STRUCTURE.md` §2. Script: `tools/socket_log/sea_capture.py`
> (branch `socket-capture`). Phân tích packet + kết luận data: `docs/sea/SEA_PACKET_ANALYSE.md`.

## 1. Chạy gì, ra gì

- `login → open-sea → leaderboards → factions → battle-map → nodes → map-pan → nodes-2`,
  fail-fast từng stage (`FAIL-<stage>.png` làm bằng chứng khi click trượt).
- `nodes` (view mặc định) 4 đảo: n01(232,322) n02(404,322) n03(318,388) n04(318,468).
  `map-pan`: wheel `scroll:320,400,600,0` zoom out — lượt 2 **clamp** (pan-1 == pan-2).
  `nodes-2` (view zoomed) 13 toạ độ: n11(263,215) n12(370,215) n13(173,268) n14(310,268)
  n15(462,268) n16(310,322) n17(310,398) n18(262,470) n19(377,470) n20(262,562)
  n21(372,562) n22(472,585) n23(365,635).
- **14/17 vị trí ăn** (n20, n21, n23 không sinh request nào — nghi ngoài vùng click của
  view zoomed hoặc đảo phụ). Không node: đền trung tâm (310,225 — mở popup "Chi tiết /
  Hiệu suất của phe ta") và đảo dưới (318,570 — không frame, nghi base phe nam).
- Mỗi node ăn đủ chu kỳ: detail → boss (kính lúp 383,251) → board (ô vàng 487,479) →
  close (318,560) + shot `probe-<n>-closed` chống kẹt popup.

## 2. Hệ toạ độ hằng số trong `sea_capture.py`

| Hằng           | Giá trị | Ghi chú                                                                                                                                |
| -------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `BOSS_LENS`    | 383,251 | kính lúp header node detail (349,251 = swap — KHÔNG click)                                                                             |
| `BOSS_CLOSE`   | 476,149 | X popup boss                                                                                                                           |
| `BOARD_STACK`  | 487,479 | ô tròn xếp chồng → node leaderboard                                                                                                    |
| `BOARD_CLOSE`  | 487,88  | X popup board                                                                                                                          |
| `DETAIL_CLOSE` | 318,560 | click nền tối dưới popup. **(80,620) không ăn** — element mờ phía đó nuốt click (probe 095825); 318,560 = đảo dưới, click trống vô hại |

Popup quảng cáo login: AFK X(463,218); promo "Tranh Đoạt U Độ" **không có X** — click
nền góc phải trên (600,90). **Tuyệt đối không click "Đến" (319,626)** — rời home.

## 3. Vụ "mọi node cùng 1-23" — đã giải (bài học artifact)

- Run 093346/094110: `DETAIL_CLOSE` chết → popup n01 không bao giờ đóng → mọi shot
  `7-n02..04` sau đó chụp đúng popup n01 ("1-23Đảo Câu Cá"). Kết luận "node nào cũng
  1-23" là **artifact**, không phải data.
- Run 100433 (close sửa xong): shot + frame cho thấy node khác nhau hẳn — request mở
  node `0x72/0x0011 {f1: id}` với id riêng từng đảo; decode id ↔ tên qua bảng
  `CampGVGLO` (`docs/sea/SEA_PACKET_ANALYSE.md` §1.2).
- Sót lại 3 shot `7-n03/n04/n13` vẫn lệch tên dù request đúng — **popup render lag khi
  auto-click nhanh**; shot `7-n14` (cùng id 63 với n03) render đúng "1-11Đảo Lều Trại",
  khớp bảng config → chốt artifact, không phải mapping khác. Bài học: khi nghi shot lệch,
  đọc kèm response frame trước shot và shot của lần click khác cùng id.

## 4. Định danh frame sea (module mới so với event mỏ)

- `0x72/0x000b→0x000c`: mở battle map → **full map state** f2×89 node {id, owner},
  f3×4 phe, f4×115 guild roster.
- `0x72/0x0011→0x0012`: mở node — f4 (1001..1009) = class art/boss, f2 = điểm ST 4 phe.
- `0x72/0x003e→0x003f`: per-node status phụ (toàn 0 pre-war).
- `0x0c/0x0002→0x0003`: leaderboard sea — f1: 116=BXH phe, 117=BXH điểm, 118=node
  (f2 = node id, 0 = toàn map).
- `0x72/0x0024→0x0025`: Tổng quan phe (4 lần, khớp stage factions).
- Heartbeat 8B `000672 0011xx 0808` + ping 6B `000402 0008xx` — seq tăng, đừng nhầm
  với request action khi lọc theo size.

## 5. Việc kế tiếp

- Xem `docs/sea/SEA_PACKET_ANALYSE.md` §2 (NEED_CONFIRM) + §3 (deliverables): crawl 89 node
  bằng payload thẳng, join `CampGVGLO` vào `src/data/map-layout.ts`.
- Capture lại sau **10/26 10:00** (khai chiến) cho dữ liệu động.

## 6. Run war-day 20261026-142917 — chốt hướng crawl payload-driven (2026-10-26)

> Run đầu trong cửa sổ chiến trường mở (14:29, khung 10:00~22:00 ngày khai chiến).
> Headed `pmain`, 8/8 stage, 549 frame, 82 shot, exit 0 — fix headed-run chạy tốt.
> shot `6-battle-map` dính frame transition trắng; dùng `probe-n01-closed` /
> `6-map-pan-1` làm bằng chứng map lúc war.

### 6.1. GUI run chỉ để verify — data lấy bằng payload theo id [chủ dự án chốt 2026-10-26]

Toạ độ node trong `sea_capture.py` chỉ phục vụ check UI. Target thật: gửi payload
thẳng theo node id, khỏi scroll/click map. Run này verify đủ chuỗi payload:

| Request                        | Response                                                                                                                             | Verify trong run                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `0x72/0x000b` (mở map)         | `0x000c` **full map**: f2×89 `{f1 id, f2 owner}` — **ids 1..89 đủ tuyệt đối**, không field nào khác per node; f3×4 phe; f4×115 guild | #393R 23KB; owner distribution 1:5, 2:4, 3:8, 4:5, trống 67 — khớp BXH Phe 8/5/5/4                                                   |
| `0x72/0x0011 {f1: id}`         | `0x0012` state node: f4 art 1001..1009, f1 id, f2×4 `{faction, Điểm ST}`                                                             | 13 click → **9 node distinct** (8/53/62/63/70/71/74/82/85); phe ta (f3) có ST: node 8=2.31M, 53=6.39M, 62=5.89M, 63=4.88M, còn lại 0 |
| `0x0c/0x0002 {f1:118, f2: id}` | `0x0003` node leaderboard                                                                                                            | 9 board: 32B (rỗng) → 352B (node 8, có data)                                                                                         |
| `0x0d/0x001f {packed ids}`     | `0x0020` id→tên                                                                                                                      | #405S 92B → #406R 8.6KB, tên inline (`"VNLight"`, `"VNs1st"`)                                                                        |

→ **Crawler kế tiếp = vòng lặp ids 1..89** (snapshot `0x000b` lấy enum + owner,
`0x0011` + board `118` per node theo chu kỳ), zero GUI interaction.

### 6.2. QuickLZ: một số response nén (status flag `01`)

Header R 8B `seq|flags|module|cmd|status` — status `01` = payload QuickLZ-compressed:
board node 8 #404R 352B không parse được (`<unparseable>`), trong khi names #406R
status `00` là protobuf thuần. Khớp commit `f61dd7a`. Crawler cần bước decompress
trước khi decode board/phe snapshot.

### 6.3. BXH game = 2 tab [chủ dự án xác nhận 2026-10-26]

Shot `4-leaderboard-*` lúc war vẫn chỉ **"XH Phe | XH điểm"**. Cấu trúc 3 tab
"Cứ điểm | Cá nhân | Phe" + sub-tab là **bước tổng hợp phía UI frontend**
(`Leaderboard.tsx`), không phải của game → đã sửa `docs/sea/SEA_STRUCTURE.md` §3.2/§7.

### 6.4. Ghi chú GUI (phụ)

- Toạ độ chết lúc war: n15, n20, n21, n23 (n15 mới chết so với pre-war — nghi bị
  panel "Đánh dấu đảo" che). Không quan trọng với hướng payload-driven.
- `7-n01` == `7-n11` cùng node 8 vì 2 view cùng trỏ 1 đảo — không phải artifact
  kẹt popup (khác vụ §3; verify bằng request id từng click).
- Điểm faction chỉ mutate qua `0x0011→0x0012` khi mở node; snapshot `0x000c`
  (đã chứa owner 89 node) là nguồn owner — re-pull theo chu kỳ là đủ.

### 6.5. `sea_crawler.py` — crawler payload-driven đã chạy thật (2026-10-26)

Tool `tools/socket_log/sea_crawler.py`: mở map **1 lần** (`0x72/0x000b` → snapshot
89 node), rồi loop từng id: state `0x72/0x0011` + board `0x0c/0x0002 {f1:118, f2:id}`,
sau đó BXH phe (116) + BXH điểm (117), decode toàn bộ board bằng runtime game trong
page (một round-trip JS duy nhất, schema attach theo name-suffix — xem
`game_proto_decode.py`), cuối cùng fetch brief `0x0d/0x001f` theo chunk 60 id.

```bash
uv run python tools/socket_log/sea_crawler.py --profile .tmp/pmain --out .tmp/sea-crawl/<run>
```

Output: `map-snapshot.json`, `node-states.jsonl`, `node-boards.jsonl` (body b64),
`boards-decoded.json`, `players.jsonl`, `summary.json`, screens chứng tục từng stage.
Inject qua `window.__wsLoggerWs` với ssid tự gán từ 0xF0 (không đụng seq của client);
correlate response theo (module, cmd, ssid) — verify v1/v2: 89/89 khớp, 0 lệch.

### 6.6. Server throttle err `10000035` — server chủ động chặn burst inject

Ba run liên tiếp (v1 16:42, v2, v3): một số request inject bị trả về body
`f1: 10000035` (không f2) — **~30/89 node mỗi run, nhưng set bị chặn KHÁC nhau giữa
các run** (board node 8 có data ở run 14:29 và v2, sang v3 lại thành body 12B
`err:10000035`). Chặn theo lô ~5 node liên tiếp, cách nhau ~12 node — pattern
duty-cycle, không phải trạng thái node. Kết luận: **quota tốc độ phía server**, không
phải dữ liệu thiếu. Đối sách trong crawler:

- `REQUEST_PACE = 0.25s` giữa 2 node (mỗi node 2 request);
- `inject_retrying()`: gặp response bất thường → retry với backoff
  `min(2^retries, 10s)`, tối đa 5 lần. Predicate "bất thường":
  state = không có field 2; board = `len(body) < 24` (body err nén ~12B, board
  thật nhỏ nhất 32B — rỗng — nên ngưỡng 24 tách sạch, đã verify trên dữ liệu v3:
  đúng 32 body 12B = đúng 32 node bị chặn).

Run v4 (17:11) với retry: **89/89 state sạch (0 locked), 89/89 board, 0 decode
error** — 6 lần throttle đều qua được ở retry đầu (backoff 1s). Data:
BXH phe 4 hàng (additionInfo đủ `fightCap/president/cityNum/guilds/vicePresidents`,
`cityNum` khớp tuyệt đối owner count: f3=8 đảo rank 1, f1=5 rank 2); BXH điểm
top-200; 24 node board có data (332 hàng), 65 board rỗng (node không chủ, không ai
đóng góp); 243 brief người chơi. Chuẩn hoá dataset so sánh: `.tmp/sea-crawl/sea-crawl-v4`.

### 6.8. Adapter crawl → UI đã lên sóng (2026-10-26)

`sea_config_extract.py` bóc lại CampGVG (dump /tmp cũ đã mất; bài học: store shell
sinh sớm — phải poll tới khi có data row, `_length > 0`). `sea_to_ui.py` join
crawl + CampGVG → `src/data/sea-live.ts`; `mapData.ts` có công tắc `LIVE`.

- **Join id**: prefix display id trong `_name` ("1-23Đảo Câu Cá") == layout id
  `map-layout.ts`; base (CampGVG type 1) nối qua tên — hướng xác định từ
  specs/map-{base,mid,right}.PNG: 1 Vịnh Thao Thiết=Đông, 2 Long Khư U Ám=Nam,
  3 Thần Tự Lấp Lánh=Bắc, 4 Thánh Đảo Lạnh Giá=Tây (NEED_CONFIRM 6 xong).
- **Owner**: live lấy thẳng owner server (snapshot), claim rule chỉ tính
  connectivity (`deriveConnected` mới trong claims.ts) — NEED_CONFIRM 6 phần
  "tự đối chiếu" khép lại.
- Verify UI: node 1-23 = game 8 hiện 2.307.224 tổng, top-1 VNChiến 850.529
  (khớp run GUI 14:29 từng chữ); game 63 → "1-11Đảo Lều Trại" khớp §1.2.
- Lệch số đã biết (board top-20, BXH top-200, boss chưa map…) liệt kê +
  phương án fix trong `docs/sea/STATS_MISMATCH.md` — handoff cho phase sau.

### 6.7. Finding dữ liệu: pool "Điểm ST" node dao động, board theo người chơi ổn định

- **Pool Điểm ST per node (f2 trong `0x0012`) FLUCTUATE**: node 64 phe 3 từ 21.8M
  xuống 0 mà owner không đổi — đây là pool đang tranh đoạt, không phải tổng cộng
  lũy tiến. So sánh giữa 2 run cách nhau vài phút có thể thấy score tụt mà không có
  đổi chủ.
- **Board per-node (per-player rows) ổn định/tích lũy**: board node 8 lúc 14:29 (GUI)
  và 16:49 (crawl v3) giống hệt nhau (VNChiến 850529 đứng đầu) — bảng này ghi đóng
  góp cá nhân, không co giãn theo pool.
- BXH phe (116) `additionInfo` giàu hơn UI: `fightCap`, `president`, `cityNum`
  (= "Chiếm đảo" trên BXH), `guilds[]`, `vicePresidents[]` — đủ để render
  Tổng quan phe khỏi cần screen nào thêm.
