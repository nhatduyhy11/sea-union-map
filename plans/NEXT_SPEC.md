# NEXT_SPEC — BXH drill-down + filter canvas theo guild / thành viên

## Context

BXH hiện tại 3 tab (Phe → Cá nhân → Cứ điểm) chỉ đọc: guild ở tab Phe là row tĩnh,
đảo trong expand của player chỉ dùng để focus, focus đảo ở tab Cứ điểm nằm sau nút
"Xem đảo trên map". Legend đáy canvas vừa show vừa filter phe — owner đánh giá
filter theo phe là kém ý nghĩa nhất và muốn thay bằng filter theo guild/thành viên,
điều khiển trực tiếp từ BXH.

Toàn bộ thống kê guild/thành viên **derive từ per-node leaderboard toàn map**
(hợp các dòng node-board, xem `domain/selectors.ts`), không dùng BXH cá nhân
fetch từ server game (chỉ top-K). Đây là constraint có sẵn của data layer, giữ
nguyên — mọi thống kê mới (thành viên guild, node contribute) derive từ cùng
nguồn `Contribution[]`. Chấp nhận lệch số so với BXH in-game (owner chốt
2026-10-26): node-board là top-N mỗi node nhưng gộp cả map nên phủ rộng hơn
top-K cá nhân của server — dùng nó để thống kê lại là chủ ý, không cần đối
chiếu khớp; tổng guild vs tổng members liệt kê lệch nhẹ cũng không xử lý đặc biệt.

## Mô hình tương tác (đã chốt với owner 2026-10-26)

### Filter là một — accordion trùng với filter

- Canvas chỉ có **một filter tại một thời điểm**: `all` / phe / guild / player
  (union, thay cho chuỗi `filter` hiện tại).
- **Tab Phe (Chung + sub-tab một phe):** click guild row → expand ra thành viên.
  Chỉ **một guild mở tại một thời điểm**; guild được mở chính là filter canvas —
  highlight node mà guild đó có contribute, **edge không highlight**.
- **Guild expand ưu tiên hơn sub-tab phe** (owner chốt 2026-10-26): mở guild
  khi đang filter phe qua sub-tab → filter chuyển sang guild, sub-tab về
  "Chung"; bấm sub-tab phe khi guild đang mở → collapse guild, filter về phe.
  Nguyên tắc: một filter, mọi control phản chiếu đúng nó.
- Click thành viên trong guild đang mở: lần 1 → filter chuyển thành player đó;
  lần nữa → quay về filter theo guild cha. Guild vẫn mở, member được chọn
  highlight trong list.
- **Tab Cá nhân:** cũng accordion — **một player mở tại một thời điểm**; player
  được mở chính là filter canvas (cùng cơ chế với member-click ở tab Phe vì
  filter là một).
- Filter theo cá nhân **chỉ có một logic**: bấm vào member trong guild ở tab
  Phe hay mở player ở tab Cá nhân đều cho **cùng một kết quả trên canvas**
  (cùng tập node highlight) — một logic, hai đường bấm UI. Filter guild chỉ
  bấm được từ tab Phe. Filter không persist qua việc đổi tab (xem reset bên
  dưới).
- **Reset view:** đổi tab BXH (Phe ↔ Cá nhân ↔ Cứ điểm), rời ranking, hoặc tự
  collapse row đang mở → filter về `all`, đóng hết expansion (owner chốt
  2026-10-26: "switch tab bxh là reset view, reset mode đang expand").

### Focus đảo — mỗi tab một vai

- **Tab Cứ điểm:** mở expand của một đảo = focus luôn đảo trên map (camera +
  mở chi tiết). Bỏ nút "Xem đảo trên map". Chỉ focus khi toggle mở, không focus
  khi đóng.
- **Tab Cá nhân:** đảo trong expand của player chỉ liệt kê + điểm — **bỏ focus**
  (trả lại vai focus cho tab Cứ điểm, tránh hai nơi cùng điều khiển camera).

### Nhãn chung + filter mode

- Label "TOÀN CHIẾN TRƯỜNG" đang lặp trong cả 3 board — move lên thành **header
  chung của panel BXH** (trên board tabs), kèm một checkbox **"Filter mode"**
  (default tick).
- **Tick (filter mode, mặc định):** đúng mô hình accordion = filter bên trên —
  một expansion tại một thời điểm, mở = lọc canvas, member toggle player↔guild,
  sub-tab phe lọc canvas.
- **Bỏ tick (xem tự do):** tắt chế độ filter của BXH — panel thuần đọc. Expand
  thoải mái nhiều guild / player / faction cùng lúc, member trong guild chỉ
  hiển thị (không toggle filter), sub-tab phe chỉ đổi view trong panel. BXH
  không side-effect gì lên canvas; tắt mode thì canvas reset về `all`.
- Mode này là state của panel — **không reset khi đổi tab BXH** (khác với
  filter/expansion). Focus-on-expand ở tab Cứ điểm giữ nguyên hành vi trong
  cả 2 mode (camera theo lần expand cuối là hành vi mong đợi).

### Legend đáy canvas — display-only

- Legend chỉ còn show màu/label các phe, **bỏ hết hành vi filter**.
- Filter phe chỉ còn một điểm điều khiển: sub-tab của BXH Phe (giữ nguyên hành
  vi canvas dim + edge highlight như cũ; chọn "Chung" = về `all`).
- Hệ quả chấp nhận: mất điểm vào filter "Trung lập" (ít giá trị, cần thì thêm
  sau). Union filter vẫn giữ case neutral ở data layer cho tương thích.

## Thay đổi kiến trúc (high-level)

- **`stores/panel`** — thêm `filterMode: boolean` (default `true`, checkbox
  "Filter mode") — state panel, sống qua các lần đổi tab.
- **`stores/mapView`** — `filter: string` thành union `{ kind: "faction" | "guild"
  | "player", id } | null` (null = all). Thêm action set/reset filter guild-player;
  command cross-store (reset khi rời board, toggle member) đặt ở `stores/commands`
  theo pattern hiện tại.
- **`domain/selectors`** — `GuildScore` mang thêm danh sách thành viên (id, tên,
  điểm, số đảo) sort theo điểm.
- **`domain/mapGraph`** — node match theo `kind` của filter: phe → owner match
  (như cũ, có edge highlight); guild/player → node có contribution của
  guild/player đó, edge giữ resting style. Cặp index `nodeIdsByGuild` /
  `nodeIdsByPlayer` derive một lần cạnh `scoresByNode`.
- **`components/panels/Leaderboard`** — header chung (eyebrow "TOÀN CHIẾN
  TRƯỜNG" + checkbox "Xem tự do") trên board tabs, bỏ eyebrow lặp trong 3 board;
  guild row thành details (accordion điều khiển bởi filter, không state mở
  riêng); member row toggle player↔guild; player tab accordion tương tự; đảo
  trong expand player thành row tĩnh; tab Cứ điểm wire onToggle → focus đảo.
  Khi `filterMode` tắt: mọi expansion thành `<details>` đa mở thuần đọc, bỏ
  toàn bộ side-effect canvas.
- **`components/map/FactionLegend`** — bỏ nút, chỉ còn swatch màu; `selectFaction`
  thu về chỉ phục vụ sub-tab BXH.

## UI/UX notes (brainstorm)

- **Header BXH** — một hàng: eyebrow "TOÀN CHIẾN TRƯỜNG" bên trái, checkbox
  "Filter mode" (default tick) bên phải. User đổi mode ít, đừng để nó thành thứ
  bắt mắt; tooltip ngắn: tick = "Mở mục là lọc map, một mục cùng lúc", bỏ tick
  = "Mở nhiều mục cùng lúc, không lọc map".
- **Chip filter trên canvas** — overlay nhỏ góc trên canvas: `[⚔ Guild A ✕]` /
  `[👤 Player1 ✕]`, ✕ reset về `all`. Cần vì khi panel cuộn dài, user nhìn map
  phải biết canvas đang lọc gì mà không nhìn panel; ✕ cũng là cách tắt lọc mà
  không phải cuộn panel tìm đúng row để collapse.
- **Node match/dim** — tái dùng pattern dim hiện tại (opacity thấp), thêm
  transition nhẹ (~150ms) cho đỡ giật. Node match có thể viền màu phe của chủ
  guild/player để đọc hướng phe mà không cần bật thêm gì.
- **Row đang filter** — nền tint màu phe nhẹ + chevron xoay; member đang được
  filter highlight mạnh hơn member thường (member là cấp "chọn sâu nhất").
- **Guild row metadata** — hiện sẵn số người; thêm số đảo guild đang contribute
  (`· 8 đảo`) để ngời ra trước việc expand, giá cả là 1 phép đếm từ index sẵn có.
- **Guild "Không guild"** — vẫn expand/liệt kê được; filter canvas theo bucket
  này match node có contribution từ player không guild. Ghi chú trong UI bằng
  chính cái tên fallback, không cần xử lý đặc biệt.
