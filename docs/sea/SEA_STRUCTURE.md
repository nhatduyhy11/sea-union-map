# Tranh Bá Tứ Hải — Cấu Trúc Event (screens ↔ dữ liệu crawl)

> Mô tả nghiệp vụ do chủ dự án truyền đạt (2026-10-24) đối chiếu với ảnh in-game
> `docs/assets/sea-socket/` (chụp 2026-10-24, trước giờ khai chiến 10/26 10:00).
> Đây là spec cho crawler Playwright (tầng `tools/socket_log/`) và nguồn dữ liệu
> thay mock cho UI `src/`. Packet sea (module `0x72`) + framing: `docs/sea/SOCKET_PROTOCOL.md`
> §4.2; config node + boss: §4.1 / §4.2 doc này.
> Chủ dự án đã xác nhận mô tả khớp (2026-10-24): phe acc + cửa sổ giờ đã chốt
> (mục 1, mục 7); các câu hỏi phụ tạm skip.

## 1. Tổng quan event

- Tên event: **Tranh Bá Tứ Hải** (tựa đề lobby, hình 3). Màn lobby là "Sea Union lobby".
- Thời gian event: **10/26 00:00 → 11/2 00:00** (hình 3).
- Cửa sổ chiến trường: lobby hiện **"Chờ chiến trường mở 10/26 10:00~22:00"**; battle map
  hiện đếm ngược "khai chiến 42 giờ 22 phút 27 giây" (hình 6) — khớp mốc 10/26 10:00
  với thời điểm chụp. **Cửa sổ lặp mỗi ngày [chốt 2026-10-24]**; ngoài khung giờ chiến
  trường đóng nên leaderboard không thể bị thay đổi — trong lúc event diễn ra, dữ liệu
  check lúc nào cũng được, chỉ là ngoài giờ không có diễn biến mới.
- **4 phe** (dải cờ cuối lobby / strip đầu battle map):

| Tên phe            | Ghi chú                                                        |
| ------------------ | -------------------------------------------------------------- |
| Vinh Thao Thiết    | rank 1 BXH Phe lúc chụp                                        |
| Long Khử U Ám      | rank 2                                                         |
| Thần Tử Lệ Lãnh    | rank 3, tag **"Phe ta"** — phe của acc chính [chốt 2026-10-24] |
| Thành Đảo Linh Giá | rank 4                                                         |

- Profile crawl là **`p545`** (đã có session đăng nhập) — **không dùng** profile cũ
  `pmain`/`p535`/`m535` [đổi từ `pmain` sang `p545` 2026-10-30]. Phe của acc không ảnh hưởng
  dữ liệu thu được: BXH là public, phe nào check cũng như nhau.
- Đơn vị điểm của event là **"Điểm ST"** (điểm sát thương): player có Điểm ST tổng (BXH điểm),
  mỗi node có Điểm ST theo phe/player, node leaderboard xếp theo Điểm ST. Trước khai chiến tất cả = 0.
- 4 phe khớp mô tả `docs/PROJECT_INTENT.md` §4.1 (4 phe, base 4 hướng đông/tây/nam/bắc).

## 2. Luồng điều hướng gốc (crawl flow)

Thứ tự thao tác = thứ tự chủ dự án mô tả; mỗi bước có ảnh bằng chứng:

| Bước | Thao tác                                                                                           | Kết quả                                               | Bằng chứng                                                                                               |
| ---- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1    | Login (profile persistent), **đóng popup quảng cáo nếu có**                                        | Home screen                                           | [hình 1](../assets/sea-socket/1-home-init.png)                                                              |
| 2    | Click icon list event ở bottom nav (**khoanh đỏ hình 1**)                                          | Event lobby **"Lối vào PB"**, đầu danh sách           | [hình 2a](../assets/sea-socket/2a-event-lobby-start.png)                                                    |
| 3    | Cuộn danh sách xuống cuối                                                                          | Banner **"Tranh Bá Tứ Hải"** (cuối list) hiện đủ      | [hình 2b](../assets/sea-socket/2b-event-lobby-scroll-end.png)                                               |
| 4    | Click **"Khiêu chiến"** trên banner Tranh Bá Tứ Hải                                                | **Sea Union lobby**                                   | [hình 3](../assets/sea-socket/3-sea-home.png) — **chụp màn này làm bằng chứng navigate đúng**               |
| 5    | Click "BXH" (menu phải, trên cùng)                                                                 | BXH, 2 tab: Phe / điểm                                | [hình 4a](../assets/sea-socket/4-leaderboard-faction.png), [4b](../assets/sea-socket/4-leaderboard-player.png) |
| 6    | Click 1 cờ trong dãy 4 cờ cuối lobby                                                               | "Tổng quan phe" — chuyển phe bằng 4 tab cờ cuối trang | [hình 5](../assets/sea-socket/5-4faction-detail.png)                                                        |
| 7    | Click **vùng trung tâm** lobby (lúc chưa mở: "Nghỉ Đấu"; khi battle mở: chữ khác, **cùng vị trí**) | **Battle map**                                        | [hình 6](../assets/sea-socket/6-battle-map.png)                                                             |
| 8    | Click 1 node trên map                                                                              | Node detail                                           | [hình 7](../assets/sea-socket/7-node-detail.png)                                                            |
| 9    | Click **kính lúp** (góc phải header node detail)                                                   | Boss detail của node                                  | [hình 9](../assets/sea-socket/9-boss-node.png)                                                              |
| 10   | Click **ô tròn xếp chồng** (góc dưới phải node detail)                                             | Node leaderboard                                      | [hình 8](../assets/sea-socket/8-node-leaderboard.png)                                                       |

Ghi chú triển khai (chưa làm): bước 7 cần xử lý 2 trạng thái (chưa mở / đang mở).
Các thao tác còn lại đều là click/cuộn — step DSL của `tools/socket_log/gui/steps.py`
(`click:X,Y`, `scroll:X,Y,DX,DY[,N]`, `seek:…`, `expect:…`, `popclose`, `shot:NAME`,
`sleep:S`, `mark:LABEL`; chạy qua CLI `capture/capture.py` hoặc `sea_socket/walkthrough.py`) đủ để chạy; bước 3→4 dùng `seek` vì list event xoay vòng theo ngày.

## 3. Màn hình và dữ liệu tương ứng

### 3.1. Lobby — `docs/assets/sea-socket/3-sea-home.png`

- Header: tên event + "Thời gian: 10/26 00:00 – 11/2 00:00" + dòng trạng thái cửa sổ chiến trường.
- Trung tâm: emblem **"Nghỉ Đấu"** = điểm vào battle map (bước 7), bao quanh là 4 nhân vật đại diện phe.
- Menu phải: **BXH** (trên cùng), Thưởng, Nhiệm Vụ. Hiện chỉ BXH nằm trong phạm vi crawl.
- Cuối trang: banner "Thông báo phe" (text thông báo) + **dãy 4 cờ phe** — mỗi cờ có tên
  và 4 số stat nhỏ (đọc chưa rõ từ ảnh, nghi gồm Xếp hàng / Chiếm đảo / Tổng Nhận Liệu + 1
  chỉ số; đối chiếu khi crawl). Dãy này là đường vào "Tổng quan phe" (bước 6).

### 3.2. BXH Phe — `docs/assets/sea-socket/4-leaderboard-faction.png` (bảng xếp hạng chung)

- Tab chuyển ở đáy màn: **"BXH Phe" | "BXH điểm"**.
- Header card: phe đang hiển thị (lúc chụp = Vinh Thao Thiết) + 3 chỉ số
  **Xếp hàng / Chiếm đảo / Tổng Nhận Liệu** + avatar chủ phe (name tag **CHỦ TỊCH**).
  Chưa rõ header hiển thị phe rank 1 hay phe đang chọn (mục 7).
- List 4 phe theo rank; mỗi dòng = rank + cờ + tên + Chiếm đảo + Tổng Nhận Liệu;
  dòng phe của acc có tag "Phe ta". Lúc chụp: 3 phe đầu Chiếm đảo = 1, phe 4 = 4,
  Tổng Nhận Liệu đều 0.
- **Điểm của phe = tổng điểm của các guild trong phe đó** [chủ dự án xác nhận
  2026-10-24]: BXH Phe xếp theo tổng Điểm ST quy góp từ từng guild thành viên.
- **Màn BXH trong game chỉ có 2 tab** "XH Phe | XH điểm" — kể cả lúc war [capture
  war-day 2026-10-26 + chủ dự án xác nhận]. Cấu trúc 3 tab **"Cứ điểm | Cá nhân |
  Phe"** + sub-tab "chung + 4 phe" là **bước tổng hợp phía UI frontend**
  (`src/components/panels/leaderboard/Leaderboard.tsx`), không phải của game.
- UI frontend dựng cấu trúc này với **thứ tự tab riêng của mình** [chủ dự án
  2026-10-25]: `src/components/panels/leaderboard/Leaderboard.tsx` 3 tab **Phe → Cá nhân → Cứ điểm** (game để Cứ
  điểm trước; UI đưa Phe lên đầu vì là aggregate chính), tab Phe có sub-tab
  Chung + 4 phe. **Mô hình tương tác, cơ chế Filter mode và quy tắc lọc canvas theo guild/thành viên**
  (thay thế hoàn toàn việc lọc theo phe cũ) được đặc tả chi tiết tại [docs/LEADERBOARD_SPECS.md](../LEADERBOARD_SPECS.md).
- **Số tổng lấy từ server, player chỉ là chi tiết best-effort** [chủ dự án
  2026-10-30]: điểm phe và điểm guild lấy từ bảng "Tổng quan phe" `0x72/0x0025`;
  điểm từng phe tại node lấy từ node state `0x72/0x0012`; BXH cá nhân là board
  117 (top-200). Node leaderboard (board 118, server cắt top-20/node, §3.7) chỉ
  dùng cho danh sách player: expand player, member guild, player tại node.
  `Contribution` = 1 dòng node leaderboard mang sẵn tên/phe/guild; không số
  tổng nào được cộng từ đó, trừ khi dump thiếu key server tương ứng. Selector ở
  `src/domain/selectors/` (`buildServerLeaderboard` / `buildFactionBoard` /
  `buildNodeBoard` / `scoresForNode`); nguồn từng số xem
  [SEA_STATS_RECONCILE.md](SEA_STATS_RECONCILE.md). Guild theo player lấy từ
  brief `0x0d/0x001f` f11. Nội dung tab "Cứ điểm"
  phía frontend là diễn giải (node xếp theo tổng Điểm ST) — chưa có ảnh game,
  xem mục 7.
- Đây là leaderboard **theo phe** ("chung") như intent §6.

### 3.3. BXH điểm — `docs/assets/sea-socket/4-leaderboard-player.png` (bảng xếp hạng cá nhân)

- Podium top 3 (hộp rank 2/1/3) + list xếp hạng bên dưới — lúc chụp toàn "Trống" (chưa khai chiến).
- Dòng cố định đáy màn: chính mình (HuAsura) + **"Điểm ST: 0"** — điểm tổng của player.
- Đây là bảng "thống kê tổng điểm các player" của intent §4. Tổng Điểm ST của một
  player qua các node board **không** bắt buộc bằng Điểm ST trên BXH này (server cắt
  top-K, chấp nhận lệch — intent §5).

### 3.4. Tổng quan phe — `docs/assets/sea-socket/5-4faction-detail.png` (detail faction)

- Vào từ cờ phe ở lobby; tiêu đề "Tổng quan phe".
- Header card giống BXH Phe (Xếp hàng / Chiếm đảo / Tổng Nhận Liệu + chủ phe CHỦ TỊCH).
- List thành viên: mỗi dòng = tên + **"Tổng điểm SHT: 0"** (SHT = sát thương) + power
  (ví dụ lúc chụp: VITAMIN 331.89M, GUCCI 336.81M, UnDead 304.9M, VGang 243.23M).
  Đây là dữ liệu "top player phân bố điểm vào cứ điểm nào" mà intent cần theo dõi.
- 4 tab cờ cuối trang: switch qua lại giữa 4 phe — **crawl đủ 4 phe, mỗi phe 1 lần**.

### 3.5. Battle map — `docs/assets/sea-socket/6-battle-map.png` (map canvas frontend đang cố hiện)

- Canvas biển, các node đảo nối nhau bằng **đường tím** (route graph), node hiện
  **"Chưa mở khóa"** kèm tên. Viewport chỉ thấy một phần → map pan/zoom được;
  crawler phải quét đủ toàn map để enumerate hết node (tổng số node: chưa biết, mục 7).
- Các tên node nhìn thấy (Thành Địa Nghỉ Dưỡng, Khu Bảo Tồn Rạn San Hô, Khu Đánh Cá
  Mưa Đá…) trùng tên node đã trace trong `src/data/map-layout.ts` (từ `specs/map-*.PNG`)
  → **xác nhận đây đúng là map mà demo đã dựng**; crawl sẽ thay bố cục/đường nối
  minh họa bằng data thật.
- Node lớn trung tâm viewport (đền) — vai trò chưa rõ (center landmark hay base phe, mục 7).
- Các thành phần phụ: strip 4 phe phía trên; đếm ngược khai chiến góc phải;
  trái có "Nhiệm Vụ" + "Thông Tin Chiến Lược"; dưới trái có dải nút
  (…Mua Giải / Thưởng / Báo Cáo / Bản đồ / Mô tả — nhãn đọc từ ảnh, từng chữ chưa chắc).

### 3.6. Node detail — `docs/assets/sea-socket/7-node-detail.png`

- Vào bằng click node. Header = **`{id}{tên}`**, ví dụ "1-23Đảo Câu Cá" — format id
  `x-nn` khớp định danh đang dùng trong demo (`2-41`, `3-1`, `4`…).
- Header phải có 2 icon: **swap (↔)** — tác dụng chưa rõ — và **kính lúp** = boss detail (§3.8).
- Card trái: **"Hiệu suất sản xuất: 12/h"** + ảnh node + trạng thái mở khóa
  ("Chưa mở khóa — 1 ngày 18 giờ", đếm ngược).
- Card phải (phía trên): tình trạng sở hữu — **"Đảo chưa có chủ"** + **"Điểm chiếm đóng
  tối thiểu: 2M"** + **"Không có phe gây ST"** (chưa phe nào có điểm tại node).
  Khi battle mở, vùng này dự kiến thay bằng điểm các phe (chưa có ảnh — capture bổ sung).
- Góc dưới phải: **ô tròn xếp chồng** → node leaderboard (§3.7).

### 3.7. Node leaderboard — `docs/assets/sea-socket/8-node-leaderboard.png`

- Popup full theo node (header "1-23Đảo Câu Cá"); BXH player **của riêng node này** —
  lúc chụp "Trống".
- Dòng đáy: chính mình + Điểm ST tại node.
- Đây là bảng "player tấn công cứ điểm, phe, điểm đóng góp" của intent §5.2.

### 3.8. Boss detail — `docs/assets/sea-socket/9-boss-node.png`

- Vào bằng kính lúp từ node detail; popup "Chi tiết" dạng clipboard.
- Nội dung: ảnh + **tên boss node** ("Tứ Hải-Oán Linh") + **mô tả trait** (chịu thêm ST,
  miễn các trạng thái, hồi HP…, keyword tô màu) + mục **"Anh Hùng Đề xuất"** (card hero kèm tag).
- Mỗi node được server gán một boss; nhiều node có thể cùng boss. Popup dùng cùng layout này.

## 4. Mô hình dữ liệu node

| Nhóm        | Trường                                              | Nguồn trên UI            | Tính chất                                              |
| ----------- | --------------------------------------------------- | ------------------------ | ------------------------------------------------------ |
| Tĩnh        | id, tên node                                        | header node detail / map | không đổi trong event                                  |
| Tĩnh        | boss (tên, trait, hero đề xuất)                     | boss detail (hình 9)     | `monsterId` từ `GetCityInfoR` → config `CampGVGMonsterLO` (§4.2); game không hiện level boss |
| Tĩnh        | hiệu suất sản xuất, điểm chiếm đóng tối thiểu       | node detail (hình 7)     | config `CampGVGLO` `_points/_interval`, `_pointRequire` (§4.1) |
| Động        | trạng thái mở khóa + countdown                      | node detail, map         |                                                        |
| Động        | sở hữu ("chưa có chủ" / phe), điểm các phe tại node | node detail              | thay đổi theo diễn biến                                |
| Động        | Điểm ST từng player tại node                        | node leaderboard         | thay đổi theo diễn biến                                |

**Node trung lập:** đảo chưa phe nào chiếm sẽ hiện "Đảo chưa có chủ" + "Điểm chiếm đóng
tối thiểu" + "Không có phe gây ST" — đúng cảnh ngày đầu event (chưa ai đủ điểm, hoặc phe
top bị ngắt đường — server đã áp rule, FE chỉ đọc owner). "Điểm chiếm đóng tối thiểu" chính là **claim threshold**
trong `docs/SEA_EVENT_RULE.md` §2 — lấy từ `_pointRequire` từng node trong dump
(`claimThreshold`).

### 4.1. Config node `CampGVGLO`

- Bảng config client **89 row, `id` == server `cityId` 1:1** (dump bằng
  `tools/socket_log/config_extract.py`, cách đào bảng `*LO`:
  [`../research/BUNDLE_RESEARCH.md`](../research/BUNDLE_RESEARCH.md) §2). Cột dùng:
  `_name`, `_type`, `_points`, `_interval`, `_pointRequire` (Điểm chiếm đóng tối thiểu),
  `_unlockTime` (day), `_monsterType`, `_occupyReward` / `_firstOccupyReward`.
- `_name` = **"{display id}{tên}"** (vd `1-23Đảo Câu Cá`) — prefix display id khớp định
  danh `src/data/map-layout.ts` (`1-23`, `2-41`, `3-1`, `4`) → join game ↔ layout nối
  thẳng, không suy vị trí. Verify chéo capture: id request khi click node khớp header
  popup (vd id 63 → `1-11Đảo Lều Trại`).
- Phân loại `_type`:

| `_type` | Số node | Loại                                            | Hiệu suất (`_points`/`_interval` phút) |
| ------- | ------- | ----------------------------------------------- | -------------------------------------- |
| 1       | 4       | base 4 phe (id 1..4) — node thường là id 5..89  | —                                      |
| 2       | 24      | đảo "1-x" (vành ngoài)                          | `1/5` = **12/h** (require 4M: `2/5` = 24/h) |
| 3       | 52      | đảo "2-x" (vành trong)                          | `4/10`·`6/10` = **24/36/h**            |
| 4       | 8       | "Khu nghỉ dưỡng 3-x"                            | `15/15` = **60/h**                     |
| 5       | 1       | trung tâm `4-1Khách Sạn Cực Lạc` (require 15M, unlock day 6) | `30/15` = **120/h**       |

- "Hiệu suất sản xuất: 12/h" trên node detail (§3.6) = `_points` điểm mỗi `_interval` phút.
- `_monsterType` `[[lo,hi,group],…]` = nhóm boss theo khoảng (nghi open-day server);
  `group` == `CampGVGMonsterLO._type` (§4.2).
- Map hex `ghostWar/maps/map_ghost_01/02.bin` trong bundle **không** phải map đảo
  (battlefield gameplay khác).

### 4.2. Boss node `CampGVGMonsterLO`

- `CityInfo.monsterId` (từ `GetCityInfoR`, 1001..1013) → `CampGVGMonsterLO.get(id)` (tên)
  → `.showBoss` → `CreepLO` (avatar, mô tả, hero đề xuất). Kính lúp boss detail (§3.8)
  không sinh request — render từ config theo `monsterId`. Verify: node 8 (1-23)
  `monsterId 1001` = "Tứ Hải-Oán Linh" khớp hình 9.
- Toàn bộ runtime store `CampGVGMonsterLO` của config đã kiểm tra có **13 row**,
  ID 1001..1013, tên đều có tiền tố "Tứ Hải-". Đây là danh mục config Sea, không
  phải chỉ tập boss đã xuất hiện trên một server; **không phải giới hạn cứng** cho
  mọi phiên bản game. `_type` 1 có 7 row 1001..1007; mỗi `_type` 2..7 có một row
  1008..1013. `_limitTime` 180s, `_battleGroundCode` 131001..131013.
- Kiểm tra 2026-11-01 trên server **545, 735 và 2**: toàn bộ 13 row khớp từng field;
  13 row `CreepLO` qua `_showBoss` cũng khớp. Hai server 735 và 2 tải cùng
  `config.64346.bin`; kết quả không chứng minh mọi server/phiên bản luôn đồng nhất.
- `CampGVGMonsterLO` đến từ config client `config.<ver>.bin`, runtime giải nén/parse
  rồi tra `CampGVGMonsterLO.get(monsterId)`. `CityInfo.monsterId` đến từ server qua
  WebSocket và quyết định boss của node; không suy ra ID cụ thể chỉ từ config node.
- Theo quy luật chủ dự án xác nhận cho event Sea: boss của một node có thể khác
  giữa các server nhưng giữ nguyên trong cùng server suốt một đợt event 7 ngày.
  Đây là thông tin nghiệp vụ, chưa phải kết quả theo dõi đủ 7 ngày của lần kiểm tra này.

| `monsterId` | Tên (bỏ tiền tố Tứ Hải-) | `_type` | `_showBoss` / `CreepLO.code` |
| --- | --- | --- | --- |
| 1001 | Oán Linh | 1 | 120071301 |
| 1002 | Nữ Hoàng Alien | 1 | 120071201 |
| 1003 | Vô Diện Giả | 1 | 120071401 |
| 1004 | Pharaoh Cổ Đại | 1 | 120071001 |
| 1005 | Thỏ Cưa Máy | 1 | 120071601 |
| 1006 | Bọ Cạp Hoàng Tuyền | 1 | 120072801 |
| 1007 | Khỉ Điên Đánh Trống | 1 | 120072201 |
| 1008 | Vô Diện Tử Thần | 2 | 120072401 |
| 1009 | Hắc Trảo | 3 | 120072101 |
| 1010 | Hắc Nữ Tăng Ca | 4 | 120072001 |
| 1011 | Cổ Thần | 5 | 120071801 |
| 1012 | Kỵ Sĩ Không Đầu | 6 | 120071501 |
| 1013 | U Ảnh Phu Nhân | 7 | 120071101 |

#### 4.2.1. Các ID và dữ liệu boss

```text
CityInfo.cityId                 → CampGVGLO.id (node)
CityInfo.monsterId              → CampGVGMonsterLO.id (config riêng Sea)
CampGVGMonsterLO.showBoss       → CreepLO.code (unit boss chính)
CreepLO.normalSkill / posSkill* / pSkills → SkillBaseLO.id
CreepLO.showHeroItem            → HeroLO.code (hero gợi ý)
```

- `monsterId` và `CreepLO.code` là hai miền ID khác nhau; không dùng thay nhau.
- Boss chính lấy từ `_showBoss`. `_showCreep` của row Alien gồm một boss và ba
  unit đi kèm; không cần mở rộng ba unit này khi chỉ hiển thị thông tin boss.
  Chưa chốt ý nghĩa các khoảng của `CampGVGLO._monsterType`; không diễn giải
  bốn khoảng đó thành bốn unit hiển thị.
- `CampGVGMonsterLO` có **38 field**: định danh, round/khởi tạo trận, thời gian,
  tài nguyên hiển thị, bộ chỉ số thường/elite/boss, thuộc tính chiến đấu và
  `isCheckBattle`. `CreepLO` boss có **48 field**, gồm tên, ba dạng mô tả
  (`_simpleDesc`, `_desc`, `_superSimpleDesc`), avatar/model/hình, skill ID,
  thuộc tính nền, tag và hero gợi ý.
- Chuỗi mô tả giữ nguyên markup game (`<color=...>`, `</c>`, `<br/>`). Các field
  như `_pSkills`, `_specialAttr`, `_showHeroItem`, `_round` là **string chứa JSON**.
- Mô tả UI, mô tả kỹ năng và giá trị buff là các nguồn riêng. Không trình bày
  phần tổng hợp từ nhiều bảng như thể nguyên văn một `_desc` duy nhất. Chỉ số
  `_atkBosslevel`/`_lifeBosslevel`/`_defenceBosslevel` chưa được giải mã thành
  công/HP/thủ thực tế trong trận.

#### 4.2.2. Alien và phạm vi danh mục toàn game

Kiểm tra trực tiếp server 545 ngày 2026-11-01:

| Node hiển thị | `cityId` | `monsterId` | `showBoss` / `CreepLO.code` |
| --- | --- | --- | --- |
| 1-17 Đảo Mát Mẻ | 50 | 1002 | 120071201 |
| 2-51 Đảo Luân Xa | 68 | 1002 | 120071201 |
| 1-7 Đảo Trường Kỷ | 7 | 1002 | 120071201 |

Cả ba dùng cùng toàn bộ row `CampGVGMonsterLO` của **Tứ Hải-Nữ Hoàng Alien**.
Hero gợi ý là Hanuman (`HeroLO.code = 50000001`). Các mô tả/skill/buff liên quan,
nguyên văn và cách kiểm tra nằm ở
[research boss catalog](../research/2026-11-01-boss-catalog.md).

Toàn bộ `CreepLO` của ba server đã kiểm tra cũng khớp từng field: **4.563 row**.
Trong đó 3.981 row có token `Boss` trong `_unit_type_tag`, với 149 tên và 77 model
khác nhau. Đây là số row/tag/chuỗi trong config; không phải số thiết kế boss độc
lập. Có nhiều biến thể chung tên/model nhưng khác `code`, thuộc tính hoặc skill.
Không gộp unit bằng tên hoặc model; danh mục toàn game phải giữ `CreepLO.code`.

#### 4.2.3. Data hiện tại và đề xuất hỗ trợ snapshot cũ

**Hiện trạng:** parser `parse_node_state` lưu `CityInfo` field 4 (`monsterId`)
trong key **`art`** của node state. Đối chiếu ngày 2026-11-01 trên 16 run: 1.362/1.362
node state có key này, phủ đủ 13 ID 1001..1013. `report.py` chưa đưa nó vào JSON
cho FE; `SeaLiveDump` hiện không có `monsterId`, `bossId` hoặc mapping boss node.
Dữ liệu được crawl rồi nhưng bị bỏ ở bước export; không nhất thiết phải crawl lại.

**Đề xuất, chưa triển khai/chốt contract FE:**

- Lưu mapping `cityId → monsterId` theo server và đợt event; có thể dùng
  `GetOutInfoR.startDt` làm một phần định danh đợt. Dùng lại mapping trong cùng
  đợt theo quy luật 7 ngày đã nêu; không suy sang server hoặc đợt khác.
- Giữ danh mục chung theo phiên bản config: `seaMonstersById[monsterId]` cho
  config Sea, `creepsByCode[code]` cho unit toàn game; skill lookup tách riêng nếu cần.
- Backfill snapshot từ `art` của raw crawl tương ứng; nếu thiếu raw thì chỉ dùng
  mapping cùng server/cùng đợt đã xác định. Vẫn cho phép thiếu boss trên data cũ.
- ID mới không có trong danh mục phải được giữ lại; hiển thị thiếu thông tin và
  extract lại config, không giới hạn cứng vào 13 ID đã thấy.
- Cache boss không tự giảm request `GetCityInfo` nếu crawler vẫn cần endpoint đó
  để cập nhật điểm phe tại node.

## 5. Quy tắc crawl (scope bước đầu)

- **Mục tiêu prove:** screenshot lobby (xác nhận navigate đúng) + **đủ detail của mọi node**:
  node detail (§3.6) + boss detail (§3.8) + node leaderboard (§3.7), kèm BXH phe/điểm,
  Tổng quan phe ×4, và quét đủ battle map.
- **Chạy trên profile `p545`** (`--profile .tmp/p545`) — không dùng profile event mỏ.
- **Boss không cần scrape popup:** `monsterId` đi kèm `GetCityInfoR` mà crawler đã
  pull mỗi node; tên/trait/hero tra config client.
- Dữ liệu động (điểm, sở hữu, leaderboard) sẽ re-crawl theo chu kỳ khi tới giai đoạn
  feed UI (không realtime — intent §3); chi tiết kỹ thuật (sink JSONL, tái dùng
  `tools/socket_log/core/runner.py` core như tầng mine) chốt lúc triển khai, không thuộc spec này.

## 6. Ánh xạ vào UI hiện có (`src/`)

| Dữ liệu crawl                      | Chỗ tiêu thụ                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| Bố cục node + đường nối            | `src/data/map-layout.ts` → `MapCanvas` / `IslandNode` / `RouteEdge`             |
| Tên node thật (`1-23 Đảo Câu Cá`…) | thay tên mock (demo chưa transcribe tên)                                        |
| Điểm chiếm đóng tối thiểu          | `claimThreshold` (đang equalize = 1)                                            |
| Sở hữu node                        | `Island.owner` ← dump `owner` (`0x72/0x000c`, server đã áp rule ngắt đường)     |
| Điểm phe tại node                  | `Island.factionScores` ← dump `nodeFactionScores` → `scoresForNode`, `NodeStats` |
| Node leaderboard top-N từng node   | `Contribution` (mang tên/phe/guild) — chỉ cho danh sách player                  |
| Điểm ST tổng player (BXH top-200)  | `buildServerLeaderboard` ← dump `playerBoard` (board 117)                       |
| Nhiên liệu phe (BXH Phe in-game)   | dump `fuel` (`0x72/0x001c`) → `FactionBoardEntry.fuel`, highlight `rankFactionsForHighlight` |
| BXH Phe (điểm phe = tổng guild)    | `buildFactionBoard` `src/domain/selectors/` → tab "BXH Phe" `src/components/panels/leaderboard/Leaderboard.tsx` |
| Guild theo player (brief f11)      | `Player.guild` — demo fill tay, crawl qua `0x0d/0x001f`                         |
| Phe + thành viên + tổng điểm       | `src/data/factions.ts`                                                          |

## 7. Điểm còn mở

**Đã chốt (2026-10-24)**:

1. Phe acc: **Thần Tử Lệ Lãnh**, profile crawl = **`p545`** (không dùng profile cũ `pmain`/`p535`; đổi 2026-10-30); leaderboard public nên phe acc không ảnh hưởng dữ liệu.
2. Cửa sổ chiến trường **lặp mỗi ngày**; ngoài giờ chiến trường đóng, leaderboard đứng yên — trong event check lúc nào cũng được.

**Tạm skip theo chủ dự án (2026-10-24)** — không chặn crawl, tự đối chiếu khi gặp trong data:

- 4 số stat trên banner mỗi phe; tác dụng icon swap (↔) trong node detail.
- Tổng số node + pattern pan — crawler tự quét đủ map, không cần chốt trước.
- Node detail khi battle đang mở; header BXH Phe là rank 1 hay phe đang chọn.
- ~~BXH Phe khi battle mở~~ **[chốt 2026-10-26, shot `4-leaderboard-faction`]**: vẫn
  list phẳng 4 dòng phe (không đôn guild), cột giữ nguyên Chiếm đảo + Tổng Nhiên Liệu.
  Guild + Tổng điểm ST riêng nằm ở "Tổng quan phe" (mỗi guild 1 dòng — shot `5-faction-1`).
- ~~Màn BXH lúc war~~ **[chốt 2026-10-26]**: game chỉ 2 tab "XH Phe | XH điểm" cả
  khi war (capture 2026-10-26); 3-tab + sub-tab là tổng hợp phía UI mình — §3.2.
  Câu hỏi "Cứ điểm xếp theo gì" không còn áp dụng cho game — do frontend tự định nghĩa.
- Các nút phụ (Thưởng / Nhiệm Vụ / Báo Cáo / Bản đồ / Mô tả…) — ngoài phạm vi crawl hiện tại.
