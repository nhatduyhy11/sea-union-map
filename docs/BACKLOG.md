# BACKLOG — Kế hoạch & Các việc tồn đọng

> Việc ghi vào đây khi phát hiện hoặc chốt yêu cầu mới; mỗi mục ghi đủ context +
> hướng fix để người sau pick up không phải đào lại. Lệch số UI vs game riêng
> một file: [`STATS_MISMATCH.md`](STATS_MISMATCH.md).

---

## I. Crawler & Backend Python

### 1. Crawler entry fail khi game load chậm — `sleep:8` cứng, không có bước chờ home ready

Phát hiện 2026-10-26, run `sea-crawl-20261026-195342`.

- **Hiện tượng**: fail ở `expect:2a-event-lobby-start` (stage `login`) — evidence
  `screens/FAIL-expect-2a-event-lobby-start.png` vẫn là màn hình loading 73%.
  Game socket mở ở t+19.7s trong khi stage `login` chỉ `sleep:8` rồi chạy
  popclose; popclose "queue drained" trên loading screen (checkbox score 0.821
  < 0.97 — không có splash nào để khớp), click outside (424,688) bị nuốt khi
  loading chưa xong → không vào được event lobby.
- **Điều kiện tái**: cache profile ngu (lần chạy đầu của phiên, asset chưa
  cached). Run kế tiếp `sea-crawl-20261026-195529` với cùng lệnh pass toàn bộ.
  Rerun tay hiện là workaround tạm thời.
- **Hướng fix**: thay `sleep:8` cứng trong STAGES bằng bước chờ sẵn sàng —
  ví dụ verb `await:<golden>` (loop expect đến khi similarity ≥ ngưỡng hoặc hết
  hạn, screenshot evidence mỗi lần thử), hoặc tối thiểu chờ WS game mở + thêm
  expect-retry trước khi vào popclose. Sửa ở `tools/socket_log/sea_socket/walkthrough.py` (STAGES) +
  `tools/socket_log/capture/capture.py` (run_step) — vẫn thuần Python/template matching, không
  đụng phần inject của `sea_socket/crawler.py`.

### 2. CampGVG config nằm ở `.tmp` — commit baseline vào repo + gộp lệnh crawl/dump

Phát hiện 2026-10-26 khi rà lại docs pipeline (nằm ở `README.md`).

- **Hiện trạng**: `campgvglo.json` (config client CampGVG, 89 row) là file
  trung gian `.tmp/` — gitignored và hay bị dọn, nên cần lại là phải
  re-extract (boot page game, cần mạng). Data này thực tế đã vào repo qua key
  `camp` của `src/data/sea-live.json`, nhưng là bản đã join, không phải file
  gốc của tool dump.
- **Việc 1 — commit baseline config**: extract lại 1 lần rồi commit
  `src/data/campgvg.json` (cạnh `sea-live.json`); `tools/socket_log/sea_socket/report.py --config`
  trỏ vào đó làm default. Lợi: pipeline chạy lại không cần bước extract;
  re-extract + `git diff` thành drift-detection khi game deploy
  bundle mới. ⚠️ Phải re-extract bằng tool cho đúng format gốc, không derive tay từ `camp` của `sea-live.json`.
- **Việc 2 — gộp lệnh crawl [1] + dump [3]**: khi config đã có đường cố định,
  `tools/socket_log/sea_socket/crawler.py` thêm `--dump` (mặc định bật) tự transform sau khi crawl —
  1 lệnh ra cả raw run lẫn JSON cho FE. Giữ `sea_socket/report.py` làm module/CLI riêng để re-dump run cũ khi cần.
- **Việc 3 — update docs kèm theo**: viết lại phần pipeline trong `README.md`
  khớp với quy trình mới và chuẩn hóa bộ thuật ngữ (crawl / extract / transform / dump).

### 3. Pipeline crawl/dump: giữ `server` và `power` trong `BRIEFS`

Phát hiện 2026-10-26 khi review data crawl phục vụ hiển thị đa server và lực chiến guild.

- **Hiện trạng**: `tools/socket_log/sea_socket/report.py` hiện drop `server` và `power` khi dump BRIEFS
  (`{name, guild}` tại line ~60) từ `players.jsonl`. Điều này làm FE thiếu dữ liệu để:
  1. Phân biệt các guild trùng tên nhưng khác server (vd: cùng tên guild nhưng ở server 517 vs 590).
  2. Tính tổng lực chiến của guild để phục vụ sắp xếp BXH Phe theo LC.
- **Hướng fix**:
  - `tools/socket_log/sea_socket/report.py`: giữ lại cả `server` và `power` trong dictionary BRIEFS khi export.
  - Cập nhật interface `SeaLiveDump["briefs"]` trong `src/data/sea-live.ts` để FE nhận diện được `server?: number` và `power?: number`.
  - Kết nối trực tiếp với Task 12 (sort guild theo LC) và Task 13 (guild id đa server).

---

## II. Canvas & Map

### 4. Trạng thái khởi tạo Map: default zoom-out sẵn (bỏ animation zoom) & không focus node nào

Gộp từ yêu cầu điều chỉnh camera ban đầu và trạng thái chọn node khi mở web.

- **Hiện trạng**:
  - Animation zoom: `src/hooks/useFitMap.ts` đang đặt `FIT_VIEW_OPTIONS = { padding: 0.15, duration: 500 }`. Khi vừa mount map, ReactFlow thực hiện animation fitView trong 500ms tạo cảm giác map tự động zoom giật ra.
  - Focus node mặc định: `src/stores/selection.ts` đang khởi tạo cứng `selected: "2-40"`, khiến trang vừa load là một cứ điểm đã bị chọn và mở sẵn chi tiết.
- **Việc cần làm**:
  - Bỏ hiệu ứng tự zoom ra: chỉnh `duration: 0` trong `FIT_VIEW_OPTIONS` (hoặc cấu hình initial viewport / fitView tức thì không transition) để map hiển thị ở trạng thái zoom out toàn cảnh ngay từ đầu.
  - Không focus node nào khi vừa vào web: đổi giá trị khởi tạo trong `src/stores/selection.ts` thành `selected: null`. Khi mở trang, map ở trạng thái trung lập hoàn toàn, không có panel chi tiết cứ điểm nào được bật trước.
- **Chỗ sửa**: `src/hooks/useFitMap.ts`, `src/components/map/MapCanvas.tsx`, `src/stores/selection.ts`.

### 5. Visual styling Map: Bảng màu 4 phe, Edge đậm nét, Edge đứt & Node trung lập xám nhạt

Chuẩn hóa lại nhận diện màu sắc 4 hướng và nâng cao độ tương phản hình ảnh trên bản đồ.

- **Bảng màu 4 phe / 4 hướng** (`src/data/factions.ts`):
  - **Phía Bắc (North)**: Màu cam (Orange).
  - **Phía Tây (West)**: Màu vàng (Yellow).
  - **Phía Đông (East)**: Màu tím (Purple).
  - **Phía Nam (South)**: Màu xanh dương nhạt (Light blue).
  - Màu mới sẽ tự động đồng bộ lên icon căn cứ, viền đảo, tuyến đường (edge) sở hữu, nhãn ở `FactionLegend` và các bảng xếp hạng.
- **Edge (tuyến đường nối)**:
  - Tô màu đậm lên: tăng độ tương phản của stroke và opacity ở `src/domain/mapGraph.ts` (ví dụ `strokeWidth: 2.5`, tăng opacity của đường nối).
  - Edge đứt (neutral link - đường nối chạm node trung lập): làm nhạt hơn đường liền (`opacity` thấp hơn hoặc màu xám dịu) để tránh gây rối mắt toàn cảnh.
- **Node trung lập (chưa chiếm / `owner: null`)**:
  - Đổi màu xám nhạt hơn một chút (tinh chỉnh `--faction` mặc định trong `src/components/map/IslandNode/IslandNode.module.css` từ `#7f929e` sang tông xám nhạt hơn).
  - Node trung lập mờ nhẹ mặc định khi không có bộ lọc (`opacity: ~0.35` ở derive layer `mapGraph.ts`), tự un-dim khi hover chuột để xem thông tin.
- **Chỗ sửa**: `src/data/factions.ts`, `src/domain/mapGraph.ts`, `src/components/map/IslandNode/IslandNode.module.css`.

### 6. Node Căn Cứ (Base): Bỏ nhãn "Bất khả chiếm" & chỉ dùng tên in-game ('Vịnh Thao Thiết', 'Long Khư'...)

Lược bỏ các nhãn thừa và hiển thị chính xác danh xưng in-game của các căn cứ phe.

- **Hiện trạng**:
  - Node căn cứ hiện hiển thị nhãn phụ `BASE · BẤT KHẢ CHIẾM` (`styles.baseNote` trong `IslandNode/index.tsx`).
  - Tên node đang ghép mã id và hướng (vd: `base-east ĐÔNG`, `Căn cứ east`), không phản ánh đúng tên cứ điểm trong game.
- **Việc cần làm**:
  - Bỏ hoàn toàn dòng nhãn phụ `BASE · BẤT KHẢ CHIẾM` khỏi node căn cứ trên canvas.
  - Bỏ tiền tố và chữ hướng như `base-east`, `ĐÔNG`, `TÂY`...
  - Chỉ hiển thị đúng tên in-game fetch được từ server (đã có trong `baseDir` của dump):
    - **Căn cứ Đông**: *Vịnh Thao Thiết*
    - **Căn cứ Nam**: *Long Khư U Ám*
    - **Căn cứ Bắc**: *Thần Tự Lấp Lánh*
    - **Căn cứ Tây**: *Thánh Đảo Lạnh Giá*
- **Chỗ sửa**: `src/components/map/IslandNode/index.tsx`, `src/data/map-layout.ts`, `src/data/sea-live.ts`.

### 7. Thanh Snapshot lịch sử các ngày event dưới label 4 phe của canvas

Hiển thị các mốc lịch sử diễn ra sự kiện để người dùng có thể xem lại diễn biến bản đồ qua các ngày.

- **Vị trí**: Đặt ở phía dưới thanh nhãn màu 4 phe của canvas (`src/components/map/FactionLegend.tsx`).
- **Giao diện**: Dãy nút thể hiện các ngày snapshot trong event, ví dụ: `[26]`, `[27]`, ...
- **Quy tắc hiển thị**:
  - Chỉ hiển thị nút của những ngày **đã qua mốc 22:00** (thời điểm kết thúc lượt đánh trong ngày của game). Các ngày chưa tới hoặc chưa qua 22h sẽ không xuất hiện.
- **Tương tác & Xử lý dữ liệu**:
  - Khi click vào nút một ngày hợp lệ: nạp lại toàn bộ dữ liệu cũ (snapshot) của ngày đó vào tất cả các tab hiện tại trên UI (canvas, BXH phe, BXH cứ điểm, cá nhân, node details).
  - Trạng thái nút: Nút của ngày đang được chọn sẽ sáng (active state) để báo hiệu đang xem snapshot lịch sử.
  - Trường hợp không có dữ liệu: nếu click vào ngày không có data snapshot tương ứng, bắn Toast thông báo lỗi (Toast Error), nút không click được / không đổi trạng thái và không làm xáo trộn màn hình hiện tại.
- **Chỗ sửa**:
  - Thêm component SnapshotBar / cập nhật `src/components/map/FactionLegend.tsx`.
  - Store quản lý active snapshot date và logic load dữ liệu lịch sử từ các file `src/data/sea-live.<date>.*.json`.
  - Tích hợp Toast notification cho trường hợp nạp dữ liệu thất bại.

### 8. Watermark góc dưới bên phải (bottom-right) của Canvas

- **Vị trí**: Nằm cố định ở góc dưới cùng bên phải của khu vực bản đồ canvas (`MapCanvas`).
- **Yêu cầu hiển thị**:
  - Watermark chữ mờ tinh tế, phong cách hài hòa với giao diện bản đồ.
  - Không cản trở tương tác của người dùng trên bản đồ (`pointer-events: none`).
  - Vị trí không đè lên các nút điều khiển (`Controls`) hoặc nhãn hiển thị zoom nếu có.
- **Chỗ sửa**: `src/components/map/MapCanvas.tsx`, `src/components/map/MapCanvas.module.css`.

---

## III. Web UI & Layout

### 9. Đổi thứ tự top tab: Xếp hạng lên trước Cứ điểm

Phát hiện 2026-10-26 — định hướng UX: người dùng vào app muốn nắm bắt cục diện BXH trước tiên.

- **Hiện trạng**: `src/stores/panel.ts` — `MapTab = "node" | "ranking"`, tab Cứ điểm (`node`) mở mặc định, Xếp hạng nằm sau.
- **Việc cần làm**:
  - Đảo thứ tự top tab trong `src/components/layout/NavigationRail.tsx`: nút Xếp hạng lên vị trí đầu tiên, Cứ điểm ở sau.
  - Đổi default tab khi mở app thành `"ranking"` trong `src/stores/panel.ts`.
  - Giữ nguyên sub-tab của BXH là Phe (`faction`) làm mặc định.
- **Chỗ sửa**: `src/stores/panel.ts`, `src/components/layout/NavigationRail.tsx`, các test liên quan đến tab navigation.

### 10. Server Switcher trên Header (`[517]`, `[590]`...) — không có nút manual new

Cho phép chuyển đổi nhanh dữ liệu hiển thị giữa các cụm server đã crawl.

- **Vị trí**: Trên thanh header ứng dụng (`src/components/layout/AppHeader.tsx`).
- **Giao diện**: Các nút bấm chuyển đổi mang tên/mã số từng server, ví dụ: `[517]`, `[590]`, `[643]`, `[777]`. Nút của server đang kích hoạt có style active riêng.
- **Nguyên tắc kỹ thuật**: **KHÔNG CÓ NÚT TẠO MỚI THỦ CÔNG (manual new)** — vì toàn bộ logic lấy và bóc tách dữ liệu server được thực hiện manual bằng pipeline backend nội bộ, không expose API hay thao tác tạo server ra phía client.
- **Hành vi**: Khi click vào một server button: chuyển đổi active server, load bộ dữ liệu tương ứng của server đó vào store và render lại toàn bộ giao diện (map layout, faction scores, leaderboards).
- **Chỗ sửa**: `src/components/layout/AppHeader.tsx`, store quản lý server hiện tại (`useServerStore` hoặc tích hợp vào app state), data loader trong `src/data/sea-live.ts`.

### 11. Layout Footer toàn trang & Watermark "From Hunter with ❤️"

Gộp yêu cầu watermark tác giả và tinh chỉnh khung layout ứng dụng.

- **Khung layout & Min-height**:
  - Thêm phần Footer cho trang web (`src/components/layout/AppFooter.tsx` hoặc tích hợp vào layout `src/App.tsx`).
  - Thiết lập chiều cao ứng dụng: app có `min-height` cố định (để đảm bảo không bị co vỡ trên màn hình nhỏ hoặc màn hình dọc).
  - Tự động co giãn: nếu chiều cao cửa sổ trình duyệt (window height) lớn hơn `min-height`, layout sẽ tự động expand chiếm trọn full height của window (`100vh` / `100dvh`).
- **Watermark**:
  - Đặt watermark credit chữ: `'From Hunter with ❤️'` (hoặc `From Hunter [S517] with ❤️`) nằm ở phía bên tay phải của footer.
  - Đồng bộ hoặc chuyển chữ ký tác giả từ header (`AppHeader.tsx`) xuống khu vực footer mới này.
- **Chỗ sửa**: `src/App.tsx`, `src/App.module.css`, `src/components/layout/AppHeader.tsx`, tạo mới `src/components/layout/AppFooter.tsx` & module CSS.

---

## IV. Bảng Xếp Hạng (BXH / Leaderboard)

### 12. BXH Phe: Sắp xếp guild theo Lực chiến (mặc định) + Option sort theo Điểm & Hiển thị `tên bang [lực chiến]`

Gộp từ yêu cầu hiển thị sức mạnh bang hội và tùy chọn sắp xếp linh hoạt.

- **Hiện trạng**:
  - Guild trong tab Phe (`FactionBoard.tsx`) hiện sort thuần theo tổng điểm đóng góp (`buildFactionBoard` ở `src/domain/selectors.ts`).
  - Lực chiến (`power`) của từng thành viên chưa được pipeline giữ lại nên chưa đưa lên UI được (đã giải quyết ở Task 3).
- **Yêu cầu mới**:
  1. **Mặc định sort theo Lực chiến**: Guild trong từng phe được sắp xếp giảm dần theo tổng Lực chiến (LC) của tất cả thành viên trong bang (`sum(power)`).
  2. **Option sort theo Điểm**: Bổ sung thêm một tùy chọn (checkbox hoặc toggle switch, mặc định **UNCHECK**) cho phép người dùng đổi sang sắp xếp bang theo Điểm ST đóng góp. Khi uncheck thì tự động quay về sort theo LC.
  3. **Hiển thị lực chiến**: Mỗi dòng guild / accordion hiển thị rõ `tên bang [lực chiến]` (vd: `HUNTERS [30.88M]` — format qua `src/utils/format.ts`), điểm ST vẫn hiển thị ở cột điểm.
- **Chỗ sửa**:
  - `src/domain/selectors.ts`: `buildFactionBoard` tính tổng LC cho guild, hỗ trợ tiêu chí sắp xếp (`sortBy: "power" | "score"`).
  - `src/components/panels/leaderboard/FactionBoard.tsx`: thêm UI option toggle sort theo điểm, truyền state sort xuống.
  - `src/components/panels/leaderboard/GuildAccordion.tsx`: cập nhật hiển thị `GuildLabel` theo format `tên [lực chiến]`.

### 13. Nhận diện Guild đa server: đổi identity sang `guildName_serverNumber`

Phát hiện 2026-10-26 — tránh xung đột dữ liệu giữa các server.

- **Vấn đề**: Hiện đang dùng tên bang làm id (`CanvasFilter`, `selectors.ts` nhóm theo `player.guild`). Khi chạy multi-server, hai guild cùng tên ở hai server khác nhau (vd `HUNTERS` ở S517 và S590) sẽ bị gộp chung làm một row, gây sai lệch điểm và drill-down.
- **Hướng fix**:
  - Đổi guild identity nội bộ thành dạng `guildName_serverNumber` (vd: `HUNTERS_517`), trong khi display name trên UI vẫn giữ nguyên là `guildName`.
  - Cập nhật `CanvasFilter` (`src/types.ts`), bucket & drill-down (`src/domain/selectors.ts`), filter matching ở canvas và legend.
  - Bucket `"Không guild"` vẫn giữ nguyên; `guild_id` số từ game giữ làm evidence.

### 14. BXH Phe: Mở rộng chiều cao vùng danh sách player khi expand guild (~15 records)

Cải thiện trải nghiệm drill-down danh sách thành viên trong bang.

- **Hiện trạng**: Khối `.allocation` trong `src/components/panels/leaderboard/shared.module.css` hiện đang đặt `max-height: 225px`. Khi expand danh sách player trong một guild, vùng này chỉ chứa được khoảng 6–8 dòng thành viên, người dùng phải cuộn chuột nhiều để xem.
- **Việc cần làm**:
  - Mở rộng chiều cao tối đa của vùng danh sách player khi expand guild lên mức hiển thị được khoảng ~15 records cùng lúc (khoảng `max-height: 420px - 450px`).
  - Có thể tách class CSS riêng cho `.memberListContainer` trong `GuildAccordion.module.css` để không ảnh hưởng ngoài ý muốn đến các khối `.allocation` nhỏ hơn ở các board khác nếu có.
- **Chỗ sửa**: `src/components/panels/leaderboard/shared.module.css` hoặc `src/components/panels/leaderboard/GuildAccordion.module.css`.

### 15. BXH Phe: Khi collapse guild chỉ unfilter canvas, không reset view / board

Tránh việc đóng mở guild làm reset toàn bộ giao diện bảng xếp hạng.

- **Hiện trạng**: Trong `src/stores/commands.ts` tại hàm `toggleGuildFilter`:
  ```ts
  if (usePanel.getState().openGuild === guild) {
    resetRankingView();
    return;
  }
  ```
  Khi người dùng click để thu gọn (collapse) một guild đang mở, hàm `resetRankingView()` được gọi, dẫn đến việc đóng luôn cả faction cha, reset sạch các trạng thái expansion và đưa view BXH về ban đầu.
- **Việc cần làm**:
  - Khi collapse guild đang mở, chỉ gỡ bỏ filter trên canvas (`setCanvasFilter(null)`) và thu gọn accordion của guild đó (`panel.setOpenGuild(null)`).
  - **Không gọi `resetRankingView()`**: giữ nguyên faction đang mở, giữ nguyên vị trí scroll và không reset trạng thái của BXH.
- **Chỗ sửa**: `src/stores/commands.ts` (hàm `toggleGuildFilter`).

### 16. BXH Cứ điểm: Expand hiển thị BXH player fetch in-game & chỉ focus vào node đang expand

Cung cấp thông tin chi tiết người chơi tấn công cứ điểm và tinh chỉnh camera focus.

- **Hiện trạng**:
  - Trong `src/components/panels/leaderboard/NodeBoard.tsx`, khi click expand một cứ điểm, mục `.allocation` hiện tại chỉ hiển thị tổng điểm của từng phe (`FactionScoreRow`).
  - Thiếu danh sách chi tiết các cá nhân tham gia công phá cứ điểm đó.
- **Việc cần làm**:
  - **Hiển thị BXH người chơi của node**: Khi expand một cứ điểm trong tab Cứ điểm, hiển thị danh sách người chơi tham gia đóng góp/tấn công cứ điểm đó (lấy từ dữ liệu fetch in-game của từng node, cấu trúc tương tự `PlayerTable` trong `NodeDetails`, hiển thị tên, phe, guild, điểm đóng góp).
  - **Focus camera**: Tab này chỉ focus vào đúng node đang được click expand (camera pan đến node đó trên map mà không làm ảnh hưởng hay xáo trộn các filter khác).
- **Chỗ sửa**: `src/components/panels/leaderboard/NodeBoard.tsx`, `src/domain/selectors.ts` (query player contributions cho từng node), layout hiển thị trong NodeBoard.

---

## Nhánh phụ: Khai Thác Guild (Mine)

Các việc tồn đọng thuộc nhánh Khai Thác Guild (module `0x48`, logger, report, streak/debuff) có mức ưu tiên thấp hơn và được quản lý riêng tại:
👉 [`docs/mine_docs/BACKLOG_MINE.md`](mine_docs/BACKLOG_MINE.md).
