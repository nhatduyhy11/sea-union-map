# Sea capture POC — walkthrough chạy thành công + phân tích frame (2026-10-24)

> Run chuẩn: `.tmp/socket-capture/sea-20261024-100433` — 8/8 stage, 634 frame, toàn bộ
> shot theo `docs/SEA_STRUCTURE.md` §2. Script: `tools/socket_log/sea_capture.py`
> (branch `socket-capture`). Phân tích packet + kết luận data: `docs/SEA_PACKET_ANALYSE.md`.

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

| Hằng | Giá trị | Ghi chú |
| --- | --- | --- |
| `BOSS_LENS` | 383,251 | kính lúp header node detail (349,251 = swap — KHÔNG click) |
| `BOSS_CLOSE` | 476,149 | X popup boss |
| `BOARD_STACK` | 487,479 | ô tròn xếp chồng → node leaderboard |
| `BOARD_CLOSE` | 487,88 | X popup board |
| `DETAIL_CLOSE` | 318,560 | click nền tối dưới popup. **(80,620) không ăn** — element mờ phía đó nuốt click (probe 095825); 318,560 = đảo dưới, click trống vô hại |

Popup quảng cáo login: AFK X(463,218); promo "Tranh Đoạt U Độ" **không có X** — click
nền góc phải trên (600,90). **Tuyệt đối không click "Đến" (319,626)** — rời home.

## 3. Vụ "mọi node cùng 1-23" — đã giải (bài học artifact)

- Run 093346/094110: `DETAIL_CLOSE` chết → popup n01 không bao giờ đóng → mọi shot
  `7-n02..04` sau đó chụp đúng popup n01 ("1-23Đảo Câu Cá"). Kết luận "node nào cũng
  1-23" là **artifact**, không phải data.
- Run 100433 (close sửa xong): shot + frame cho thấy node khác nhau hẳn — request mở
  node `0x72/0x0011 {f1: id}` với id riêng từng đảo; decode id ↔ tên qua bảng
  `CampGVGLO` (`docs/SEA_PACKET_ANALYSE.md` §1.2).
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

- Xem `docs/SEA_PACKET_ANALYSE.md` §2 (NEED_CONFIRM) + §3 (deliverables): crawl 89 node
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

| Request | Response | Verify trong run |
| --- | --- | --- |
| `0x72/0x000b` (mở map) | `0x000c` **full map**: f2×89 `{f1 id, f2 owner}` — **ids 1..89 đủ tuyệt đối**, không field nào khác per node; f3×4 phe; f4×115 guild | #393R 23KB; owner distribution 1:5, 2:4, 3:8, 4:5, trống 67 — khớp BXH Phe 8/5/5/4 |
| `0x72/0x0011 {f1: id}` | `0x0012` state node: f4 art 1001..1009, f1 id, f2×4 `{faction, Điểm ST}` | 13 click → **9 node distinct** (8/53/62/63/70/71/74/82/85); phe ta (f3) có ST: node 8=2.31M, 53=6.39M, 62=5.89M, 63=4.88M, còn lại 0 |
| `0x0c/0x0002 {f1:118, f2: id}` | `0x0003` node leaderboard | 9 board: 32B (rỗng) → 352B (node 8, có data) |
| `0x0d/0x001f {packed ids}` | `0x0020` id→tên | #405S 92B → #406R 8.6KB, tên inline (`"VNLight"`, `"VNs1st"`) |

→ **Crawler kế tiếp = vòng lặp ids 1..89** (snapshot `0x000b` lấy enum + owner,
`0x0011` + board `118` per node theo chu kỳ), zero GUI interaction.

### 6.2. Codec nén: header xác nhận, match encoding CHƯA giải được (2026-10-26)

Header R 8B `seq|flags|module|cmd|compress` — compress `01` = body nén (27 frame trong
run). Body `0x47` (12 frame, mọi board có data + 2 push `0x12`) self-validate:
`[flags:1][comp_size:4 LE == body len][raw_size:4 LE][stream][crc32:4]` — ví dụ #404R
352B → 708 raw, crc `0x12818e1`. Đã xác nhận bằng decode thật:
- control word 32-bit LE, bit LSB-first, 1 bit/op;
- literal = bit 0 → copy 1 byte — 31 literal đầu của #404 ra nguyên văn protobuf
  (`08 00 1a 20 08 01 22 0c {"campId":3} 11 <fixed64> 18 ba`) khớp cấu trúc board.
Chưa giải: **match encoding** (m = LE16 sau bit 1). Đã loại trừ hệ thống: off=(m>>k)+1
và off=(m&mask)+1 với k ∈ 4..12, len = phần còn lại + 2/3/4, ext byte khi nib 0/15
(b3/b0/b17/b18), fetch 1 hay 2 bit/match — CRC32 oracle không ăn combo nào (3 match
bắt buộc phải cùng một split giải hợp lệ:
`0x00a0` chỉ hợp lệ với off ≤ 31; `0x281b` off ≤ 39; `0x13b9` off ≤ 55 — cùng một
split phải giải được cả ba).

→ **Kế hoạch**: sau maintenance, dùng headless boot page (như §4 CampGVGLO) gọi
decompressor của client trên chính bytes đã capture → có cặp (nén, raw) ground truth
→ port sang python + verify bằng CRC. Đến lúc đó bỏ qua frame `compress=01`, chỉ dùng
frame `00` (snapshot `0x72/0x000c`, `0x72/0x0012`, name lookup `0x0d/0x0020` — đủ
owner 89 node + điểm phe theo node).

### 6.3. BXH game = 2 tab [chủ dự án xác nhận 2026-10-26]

Shot `4-leaderboard-*` lúc war vẫn chỉ **"XH Phe | XH điểm"**. Cấu trúc 3 tab
"Cứ điểm | Cá nhân | Phe" + sub-tab là **bước tổng hợp phía UI frontend**
(`Leaderboard.tsx`), không phải của game → đã sửa `docs/SEA_STRUCTURE.md` §3.2/§7.

### 6.4. Ghi chú GUI (phụ)

- Toạ độ chết lúc war: n15, n20, n21, n23 (n15 mới chết so với pre-war — nghi bị
  panel "Đánh dấu đảo" che). Không quan trọng với hướng payload-driven.
- `7-n01` == `7-n11` cùng node 8 vì 2 view cùng trỏ 1 đảo — không phải artifact
  kẹt popup (khác vụ §3; verify bằng request id từng click).
- Điểm faction chỉ mutate qua `0x0011→0x0012` khi mở node; snapshot `0x000c`
  (đã chứa owner 89 node) là nguồn owner — re-pull theo chu kỳ là đủ.
