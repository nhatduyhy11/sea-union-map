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
