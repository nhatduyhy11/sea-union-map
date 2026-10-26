# BACKLOG — các việc đã nhận biết, chưa làm

> Việc ghi vào đây khi phát hiện nhưng không sửa ngay; mỗi mục ghi đủ context +
> hướng fix để người sau pick up không phải đào lại. Lệch số UI vs game riêng
> một file: [`STATS_MISMATCH.md`](STATS_MISMATCH.md).

## 1. Crawler entry fail khi game load chậm — `sleep:8` cứng, không có bước chờ home ready

Phát hiện 2026-10-26, run `sea-crawl-20261026-195342`.

- **Hiện tượng**: fail ở `expect:2a-event-lobby-start` (stage `login`) — evidence
  `screens/FAIL-expect-2a-event-lobby-start.png` vẫn là màn hình loading 73%.
  Game socket mở ở t+19.7s trong khi stage `login` chỉ `sleep:8` rồi chạy
  popclose; popclose "queue drained" trên loading screen (checkbox score 0.821
  < 0.97 — không có splash nào để khớp), click outside (424,688) bị nuốt khi
  loading chưa xong → không vào được event lobby.
- **Điều kiện tái**: cache ngu profile (lần chạy đầu của phiên, asset chưa
  cached). Run kế tiếp `sea-crawl-20261026-195529` với cùng lệnh pass toàn bộ.
  Rerun tay hiện là workaround chấp nhận được.
- **Hướng fix**: thay `sleep:8` cứng trong STAGES bằng bước chờ sẵn sàng —
  ví dụ verb `await:<golden>` (loop expect đến khi similarity ≥ ngưỡng hoặc hết
  hạn, screenshot evidence mỗi lần thử), hoặc tối thiểu chờ WS game mở + thêm
  expect-retry trước khi vào popclose. Sửa ở `sea_capture.py` (STAGES) +
  `socket_capture.py` (run_step) — vẫn thuần Python/template matching, không
  đụng phần inject của `sea_crawler.py`.

## 2. Background trang: watermark "Hunter [S517]" xoay 45°

- **Việc**: nền page (dưới map/panel) thêm watermark chữ `Hunter [S517]` xiên
  45deg, mờ, không cản tương tác (`pointer-events: none`) — cùng voice với
  credit "From Hunter [S517] with ❤️" ở `src/components/layout/AppHeader.tsx`.
- **Chỗ sửa**: global `src/style.css` và/hoặc layout `src/App.tsx`; xoay bằng
  CSS `transform: rotate(45deg)`. Chỉnh z-index để nằm dưới mọi panel.
- **Cần owner chốt trước khi làm**: một dòng chữ lớn giữa map hay tile lặp
  (background-repeat), opacity cụ thể, có hiện ở cả chế độ demo/LIVE hay chỉ
  LIVE.

## 3. Guild id trùng tên giữa các server — đổi sang `guildName_serverNumber`

Phát hiện 2026-10-26 khi review data crawl.

- **Vấn đề**: guild đang **dùng tên làm id** (`src/types.ts:95` — comment tại
  `CanvasFilter`, bucket ở `src/domain/selectors.ts` nhóm theo
  `player.guild ?? "Không guild"`). Data thật là multi-server — `players.jsonl`
  brief có cả `server` (vd `server: 517`, guild `HUNTERS` id 5170010), nên hai
  guild cùng tên khác server sẽ **dính vào một row**: BXH Phe gộp nhầm điểm,
  filter guild chọn một là sáng cả hai, drill-down trộn member.
- **Hiện trạng pipeline**: `sea_to_ui.py` drop `server` khi dump BRIEFS
  (`{name, guild}` — `sea_to_ui.py:60`) nên FE hiện không đủ dữ liệu để ghép id.
- **Hướng fix**:
  1. `sea_to_ui.py`: giữ `server` vào BRIEFS (và contributions nếu cần).
  2. FE: guild identity thành `guildName_serverNumber` (vd `HUNTERS_517`);
     display name vẫn `guildName` riêng. Chạm `CanvasFilter` (`types.ts`),
     bucket + `GuildScore`/drill-down (`selectors.ts`), filter matching ở
     canvas/legend.
  3. Update test selectors + fixture demo (demo data thêm `server` để test
     đường trùng tên).
- **Không đổi**: bucket `"Không guild"` giữ nguyên; `guild_id` số từ brief vẫn
  là evidence, không dùng làm id UI.

## 4. Đổi thứ tự top tab: Xếp hạng lên trước Cứ điểm

Phát hiện 2026-10-26 — owner muốn vào là thấy BXH trước.

- **Hiện trạng**: `src/stores/panel.ts` — `MapTab = "node" | "ranking"`, tab
  Cứ điểm (`node`) mở mặc định, Xếp hạng nằm sau. Sub-tab BXH hiện
  `faction | player | node` (Phe → Cá nhân → Cứ điểm).
- **Việc**: đảo thứ tự top tab → `ranking` trước, `node` sau; tab mặc định khi
  mở app thành Xếp hạng. Chạm `panel.ts` (type + initial `tab`), nav/header
  render theo thứ tự mới, test liên quan.
- **Mở**: sub-tab BXH giữ nguyên Phe → Cá nhân → Cứ điểm hay cũng đổi — chốt
  với owner khi làm.

## 5. BXH Phe: sort guild theo lực chiến tổng + display `tên bang [lực chiến]`

Phát hiện 2026-10-26 — owner muốn rank guild theo sức mạnh, không phải đóng góp.

- **Hiện trạng**: guild trong tab Phe sort theo tổng điểm đóng góp
  (`buildFactionBoard` ở `src/domain/selectors.ts`, hiển thị tại
  `src/components/panels/leaderboard/FactionBoard.tsx` — `GuildLabel` +
  `{number(guild.score)}`). `power` của player **không vào được UI**:
  `players.jsonl` brief có `power` (vd 30.887.328) nhưng `sea_to_ui.py` dump
  BRIEFS chỉ `{name, guild}` — cùng dạng drop như `server` ở task 3.
- **Việc**:
  1. Pipeline: `sea_to_ui.py` giữ `power` vào BRIEFS (gộp 1 lần với `server`
     của task 3 — cùng chỗ sửa).
  2. Domain: guild có `power = sum(power thành viên)` trong `buildFactionBoard`
     (`GuildScore` thêm field); sort guild **luôn theo power giảm dần**, điểm
     đóng góp chỉ còn là cột hiển thị.
  3. UI: guild row/accordion hiển thị `tên bang [lực chiến]` (vd
     `HUNTERS [30.88M]` — format qua `src/utils/format.ts`); `GuildAccordion`
     và chỗ `GuildLabel` render.
  4. Test: sort order + sum power; fixture demo thêm `power`.
- **Lưu ý**: player thiếu brief thì không có power — cần quy ước (0 hay xếp
  cuối, không crash sum).

## 6. Node trung lập mờ sẵn mặc định (vẫn hover được)

Phát hiện 2026-10-26 — với data LIVE, 65/89 node là trung lập (owner 0), chiếm
gần hết map khiến các đảo có chủ chìm mất.

- **Hiện trạng**: node trung lập = `owner: null` (`src/domain/mapData.ts`).
  Cơ chế mờ có sẵn: `data.dim` → `.dim { opacity: 0.2 }`
  (`src/components/map/IslandNode/IslandNode.module.css`), được set ở derive
  layer `mapGraph.ts` và chỉ bật khi **filter guild/player** đang chạy —
  không có filter thì không node nào mờ.
- **Việc**: node `owner: null` mờ sẵn khi không có filter — mở rộng điều kiện
  `dim` ở derive layer (`mapGraph.ts`, hiện `matched !== null &&
!matched.has(id)`), giữ hover hoạt động bình thường (opacity không chặn
  pointer events; cân nhắc un-dim khi hover để đọc rõ). Khi filter
  guild/player bật: ưu tiên logic filter hiện tại, node trung lập vẫn mờ
  như thường.
- **Cần chốt khi làm**: mức mờ — dùng lại 0.2 hay nhẹ hơn (vd 0.35) vì đây là
  trạng thái mặc định, không phải trạng thái lọc.

## 7. CampGVG config nằm ở `.tmp` — commit baseline vào repo + gộp lệnh crawl/dump

Phát hiện 2026-10-26 khi rà lại docs pipeline (giờ nằm ở `README.md`).

- **Hiện trạng**: `campgvglo.json` (config client CampGVG, 89 row) là file
  trung gian `.tmp/` — gitignored và hay bị dọn, nên cần lại là phải
  re-extract (boot page game, cần mạng). Data này thực tế đã vào repo qua key
  `camp` của `src/data/sea-live.json`, nhưng là bản đã join, không phải file
  gốc của tool dump.
- **Việc 1 — commit baseline config**: extract lại 1 lần rồi commit
  `src/data/campgvg.json` (cạnh `sea-live.json`); `sea_to_ui.py --config`
  trỏ vào đó làm default. Lợi: pipeline chạy lại không cần bước extract;
  re-extract + `git diff` thành drift-detection miễn phí khi game deploy
  bundle mới (season mới, sửa node — thấy ngay trong review). ⚠️ Phải
  re-extract bằng tool cho đúng format gốc, đừng derive tay từ `camp` của
  `sea-live.json` (schema có thể biến đổi lúc join).
- **Việc 2 — gộp lệnh crawl [1] + dump [3]**: khi config đã có đường cố định,
  `sea_crawler.py` thêm `--dump` (mặc định bật) tự transform sau khi crawl —
  1 lệnh ra cả raw run lẫn JSON cho FE. Transform là hàm thuần vài ms nên
  gộp ở tầng lệnh được; giữ `sea_to_ui.py` làm module/CLI riêng để re-dump
  run cũ — crawl đắt (login, throttle pacing, vài phút) còn dump rẻ (ms),
  sửa transform phải re-dump nhiều lần mà không muốn crawl lại.
- **Việc 3 — update docs kèm theo (cùng change với việc 1+2, docs theo code
  chứ không đi trước)**: viết lại phần pipeline cho khớp arrangement mới +
  chốt bộ thuật ngữ, vì bản hiện tại gây rối (đã xác nhận với owner):
  - **Thuật ngữ dùng nhất quán** — **crawl** = thu data live từ server
    (`sea_crawler.py`); **extract** = bóc config tĩnh từ bundle client
    (`sea_config_extract.py`); **transform** = hàm thuần biến đổi crawl
    output + config thành schema FE (nằm trong `sea_to_ui.py`); **dump** =
    transform + ghi file JSON. Hiện docs dùng "dump" lẫn lộn cả ba nghĩa.
  - `README.md` (mục Crawler — mode sea): flow mới 1 lệnh
    `sea_crawler.py --profile …`; vai trò mới của `sea_to_ui.py` là
    **re-dump tool** (command giữ nguyên, `--config` thành optional); ghi rõ
    [1]/[2] độc lập thứ tự và [2] chạy 1 lần rồi reuse.
  - `README.md` (mục "Luồng crawl → UI"): cập nhật sơ đồ luồng +
    ranh giới vai trò từng tool theo arrangement mới.

---

## Nhánh phụ: Khai Thác Guild (Mine)

Các việc tồn đọng thuộc nhánh Khai Thác Guild (module `0x48`, logger, report, streak/debuff) có mức ưu tiên thấp hơn và được quản lý riêng tại:
👉 [`docs/mine_docs/BACKLOG_MINE.md`](mine_docs/BACKLOG_MINE.md).
