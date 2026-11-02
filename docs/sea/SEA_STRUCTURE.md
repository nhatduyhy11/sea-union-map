# Tranh Bá Tứ Hải — Cấu Trúc Event (screens ↔ dữ liệu crawl)

> Mô tả nghiệp vụ do chủ dự án xác nhận (2026-10-24), đối chiếu ảnh in-game
> `docs/assets/sea-socket/` (chụp trước giờ khai chiến 10/26 10:00).
> Packet sea (module `0x72`): [SOCKET_PROTOCOL.md](SOCKET_PROTOCOL.md) §4.2.

## 1. Tổng quan event

- Tên event: **Tranh Bá Tứ Hải** (tựa đề lobby, hình 3). Màn lobby là "Sea Union lobby".
- Thời gian event: **10/26 00:00 → 11/2 00:00** (hình 3).
- Cửa sổ chiến trường **10:00~22:00, lặp mỗi ngày** (lobby: "Chờ chiến trường mở";
  battle map: đếm ngược khai chiến, hình 6). Ngoài giờ dữ liệu đứng yên — trong event
  check lúc nào cũng được.
- **4 phe** (dải cờ cuối lobby / strip đầu battle map): **Vịnh Thao Thiết**,
  **Long Khư U Ám**, **Thần Tự Lấp Lánh**, **Thánh Đảo Lạnh Giá** (tên = tên base
  in-game; thứ tự hiển thị và màu trên web: `LEADERBOARD_SPECS.md` §1.4).
- Phe của acc crawl không ảnh hưởng dữ liệu: BXH là public (dòng phe của acc chỉ
  thêm tag "Phe ta").
- Đơn vị điểm của event là **"Điểm ST"** (điểm sát thương): player có Điểm ST tổng (BXH điểm),
  mỗi node có Điểm ST theo phe/player, node leaderboard xếp theo Điểm ST. Trước khai chiến tất cả = 0.

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

Luồng này là đường đi trên GUI, dùng cho `sea_socket/walkthrough.py` (STAGES) và
`crawler.py --gui-entry`; crawler mặc định vào thẳng bằng payload, không click (§5).
Bước 3→4 dùng `seek` (step DSL `tools/socket_log/gui/steps.py`) vì list event xoay
vòng theo ngày.

## 3. Màn hình và dữ liệu tương ứng

### 3.1. Lobby — `docs/assets/sea-socket/3-sea-home.png`

- Header: tên event + "Thời gian: 10/26 00:00 – 11/2 00:00" + dòng trạng thái cửa sổ chiến trường.
- Trung tâm: emblem **"Nghỉ Đấu"** = điểm vào battle map (bước 7), bao quanh là 4 nhân vật đại diện phe.
- Menu phải: **BXH** (trên cùng), Thưởng, Nhiệm Vụ. Hiện chỉ BXH nằm trong phạm vi crawl.
- Cuối trang: banner "Thông báo phe" (text thông báo) + **dãy 4 cờ phe** — mỗi cờ có tên
  và 4 số stat nhỏ (đọc chưa rõ từ ảnh, nghi gồm Xếp hàng / Chiếm đảo / Tổng Nhiên Liệu + 1
  chỉ số; đối chiếu khi crawl). Dãy này là đường vào "Tổng quan phe" (bước 6).

### 3.2. BXH Phe — `docs/assets/sea-socket/4-leaderboard-faction.png` (bảng xếp hạng chung)

- Màn BXH trong game **chỉ có 2 tab** ở đáy: **"XH Phe" | "XH điểm"**, kể cả lúc war.
- Header card: một phe + 3 chỉ số **Xếp hàng / Chiếm đảo / Tổng Nhiên Liệu** + avatar
  chủ phe (name tag **CHỦ TỊCH**).
- List phẳng 4 phe theo rank (không đôn guild); mỗi dòng = rank + cờ + tên + Chiếm đảo
  + Tổng Nhiên Liệu. Guild và Điểm ST từng guild nằm ở "Tổng quan phe" (§3.4).
- **Điểm của phe = tổng Điểm ST của các guild trong phe** [chủ dự án xác nhận].
- Đây là leaderboard **theo phe** ("chung") như intent §6.

### 3.3. BXH điểm — `docs/assets/sea-socket/4-leaderboard-player.png` (bảng xếp hạng cá nhân)

- Podium top 3 (hộp rank 2/1/3) + list xếp hạng bên dưới (server trả top-200).
- Dòng cố định đáy màn: acc đang đăng nhập + **"Điểm ST"** tổng của acc.
- Đây là bảng "thống kê tổng điểm các player" của intent §4. Không đối chiếu được
  với tổng node board: [SEA_STATS_RECONCILE.md](SEA_STATS_RECONCILE.md).

### 3.4. Tổng quan phe — `docs/assets/sea-socket/5-4faction-detail.png` (detail faction)

- Vào từ cờ phe ở lobby; tiêu đề "Tổng quan phe".
- Header card giống BXH Phe (Xếp hàng / Chiếm đảo / Tổng Nhiên Liệu + chủ phe CHỦ TỊCH).
- List guild của phe: mỗi dòng = 1 guild — tên + **"Tổng điểm SHT"** (SHT = sát thương)
  + lực chiến. Tổng điểm các dòng = điểm phe (§3.2).
- 4 tab cờ cuối trang: switch qua lại giữa 4 phe — **crawl đủ 4 phe, mỗi phe 1 lần**.

### 3.5. Battle map — `docs/assets/sea-socket/6-battle-map.png` (map canvas frontend đang cố hiện)

- Canvas biển, các node đảo nối nhau bằng **đường tím** (route graph), node hiện
  **"Chưa mở khóa"** kèm tên. Viewport chỉ thấy một phần → map pan/zoom được
  (89 node, §4.1).
- Tên node trên map trùng tên node đã trace trong `src/data/map-layout.ts` (từ
  `specs/map-*.PNG`) → đây đúng là map canvas web dựng lại.
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
  Khi đã có phe gây ST, vùng này hiện điểm các phe (layout chưa đặc tả, mục 7).
- Góc dưới phải: **ô tròn xếp chồng** → node leaderboard (§3.7).

### 3.7. Node leaderboard — `docs/assets/sea-socket/8-node-leaderboard.png`

- Popup full theo node (header "1-23Đảo Câu Cá"); BXH player **của riêng node này**
  (server cắt top-20/node).
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
| Tĩnh        | boss (tên, trait, hero đề xuất)                     | boss detail (hình 9)     | §4.2; game không hiện level boss                       |
| Tĩnh        | hiệu suất sản xuất, điểm chiếm đóng tối thiểu       | node detail (hình 7)     | §4.1                                                   |
| Động        | trạng thái mở khóa + countdown                      | node detail, map         |                                                        |
| Động        | sở hữu ("chưa có chủ" / phe), điểm các phe tại node | node detail              | thay đổi theo diễn biến                                |
| Động        | Điểm ST từng player tại node                        | node leaderboard         | thay đổi theo diễn biến                                |

"Điểm chiếm đóng tối thiểu" chính là **claim threshold** trong `docs/SEA_EVENT_RULE.md`
§2 — `_pointRequire` từng node, dump field `claimThreshold`. Node trung lập (chưa ai đủ
điểm, hoặc phe top bị ngắt đường) do server quyết, FE chỉ đọc owner.

### 4.1. Config node `CampGVGLO`

- Bảng config client **89 row, `id` == server `cityId` 1:1** (dump bằng
  `tools/socket_log/config_extract.py`, cách đào bảng `*LO`:
  [`../research/BUNDLE_RESEARCH.md`](../research/BUNDLE_RESEARCH.md) §2). Cột dùng:
  `_name`, `_type`, `_points`, `_interval`, `_pointRequire` (Điểm chiếm đóng tối thiểu),
  `_unlockTime` (day), `_monsterType`, `_occupyReward` / `_firstOccupyReward`.
- `_name` = **"{display id}{tên}"** (vd `1-23Đảo Câu Cá`) — prefix display id khớp định
  danh `src/data/map-layout.ts` (`1-23`, `2-41`, `3-1`, `4`) → join game ↔ layout nối
  thẳng, không suy vị trí.
- Phân loại `_type`:

| `_type` | Số node | Loại                                            | Hiệu suất (`_points`/`_interval` phút) |
| ------- | ------- | ----------------------------------------------- | -------------------------------------- |
| 1       | 4       | base 4 phe (id 1..4) — node thường là id 5..89  | —                                      |
| 2       | 24      | đảo "1-x" (vành ngoài)                          | `1/5` = **12/h** (require 4M: `2/5` = 24/h) |
| 3       | 52      | đảo "2-x" (vành trong)                          | `4/10`·`6/10` = **24/36/h**            |
| 4       | 8       | "Khu nghỉ dưỡng 3-x"                            | `15/15` = **60/h**                     |
| 5       | 1       | trung tâm `4-1Khách Sạn Cực Lạc` (require 15M, unlock day 6) | `30/15` = **120/h**       |

- "Hiệu suất sản xuất: 12/h" trên node detail (§3.6) = `_points` điểm mỗi `_interval` phút.
- `_monsterType` `[[lo,hi,group],…]` = nhóm boss theo khoảng (nghi open-day server, chưa
  chốt); `group` == `CampGVGMonsterLO._type` (§4.2). Không diễn giải các khoảng thành
  các unit hiển thị.

### 4.2. Boss node `CampGVGMonsterLO`

```text
CityInfo.cityId                 → CampGVGLO.id (node)
CityInfo.monsterId              → CampGVGMonsterLO.id (config riêng Sea)
CampGVGMonsterLO.showBoss       → CreepLO.code (unit boss chính)
CreepLO.normalSkill / posSkill* / pSkills → SkillBaseLO.id
CreepLO.showHeroItem            → HeroLO.code (hero gợi ý)
```

- Trong raw crawl (`node-states.jsonl`), `monsterId` nằm dưới key **`art`** — tên key
  cũ của parser `parse_node_state`, giữ nguyên để không lệch raw run đã crawl. Mọi
  run có `node-states.jsonl` đều có key này (raw sớm nhất còn lại: 2026-10-29).
- `monsterId` do server trả trong `GetCityInfoR` và quyết định boss của node; không
  suy từ config node. Kính lúp boss detail (§3.8) không sinh request — game render từ
  config client theo `monsterId` (tên, avatar, mô tả, hero đề xuất).
- `monsterId` và `CreepLO.code` là hai miền ID khác nhau, không dùng thay nhau. Boss
  chính lấy từ `_showBoss`; các unit khác trong `_showCreep` không thuộc thông tin boss.
- Boss của một node có thể khác giữa các server nhưng **giữ nguyên trong cùng server
  suốt một đợt event 7 ngày** [chủ dự án xác nhận].
- Config hiện tại có **13 row** 1001..1013 (tên đều có tiền tố "Tứ Hải-"), giống nhau
  giữa các server đã kiểm tra. Đây không phải giới hạn cứng: ID mới phải được giữ lại,
  hiển thị thiếu thông tin và extract lại config.
- Export boss cho FE: file riêng `src/data/node-bosses/<ngày đầu đợt>/<server>.json`
  (gameNodeId → monsterId), không nằm trong snapshot — xem
  [SEA_LIVE_DATA.md](SEA_LIVE_DATA.md#các-file-json).
- Raw config, cách enumerate và phạm vi đã kiểm chứng:
  [research boss catalog](../research/2026-11-01-boss-catalog.md).

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

## 5. Quy tắc crawl

- Crawler (`tools/socket_log/sea_socket/crawler.py`) lấy mọi màn ở §3 qua packet,
  không đọc màn hình (kể cả boss, §4.2): [SOCKET_PROTOCOL.md](SOCKET_PROTOCOL.md) §4.2.
- Dữ liệu động (điểm, sở hữu, leaderboard) re-crawl theo chu kỳ, không realtime
  (intent §3). Pipeline crawl → dump → UI: `README.BE.md` và
  [SEA_LIVE_DATA.md](SEA_LIVE_DATA.md).

## 6. Ánh xạ vào UI

Cấu trúc 3 tab Phe / Cá nhân / Cứ điểm và dump field ↔ chỗ tiêu thụ trên web:
[LEADERBOARD_SPECS.md](../LEADERBOARD_SPECS.md) §1.2, §1.3, §3; nguồn từng con số:
[SEA_STATS_RECONCILE.md](SEA_STATS_RECONCILE.md) §3.

## 7. Điểm còn mở

Tạm skip theo chủ dự án — không chặn crawl, tự đối chiếu khi gặp trong data:

- 4 số stat trên banner mỗi phe; tác dụng icon swap (↔) trong node detail.
- Node detail khi battle đang mở; header BXH Phe là rank 1 hay phe đang chọn.
- Các nút phụ (Thưởng / Nhiệm Vụ / Báo Cáo / Bản đồ / Mô tả…) — ngoài phạm vi crawl hiện tại.
