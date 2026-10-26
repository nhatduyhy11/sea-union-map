# NEXT_SPEC — BXH drill-down + filter canvas theo guild / thành viên

> Spec đã break thành 3 sub-spec ở `plans/next/`. File này giữ context chung
> + **mô hình tương tác** (hợp đồng hành vi đã chốt với owner — nguồn chân lý
> duy nhất); sub-spec giữ scope + kiến trúc của từng phần, không lặp lại
> hành vi.

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

- Canvas chỉ có **một filter tại một thời điểm**: `all` / guild / player
  (union, thay cho chuỗi `filter` hiện tại). **Không còn filter theo phe** —
  owner chốt 2026-10-26 (review): highlight phe + edges không có ý nghĩa,
  drop; BXH xoay quanh cơ chế highlight node.
- **Tab Phe:** click guild row → expand ra thành viên.
  Chỉ **một guild mở tại một thời điểm**; guild được mở chính là filter canvas —
  highlight node mà guild đó có contribute, **edge không highlight**.
- **Sub-tab phe (Chung + một phe) chỉ là view của panel**, không đụng canvas ở
  cả 2 mode (hệ quả drop filter phe): "Chung" = list 4 phe, phe X = card X.
  View-local, reset khi rời board. Faction summary row cũng không phải filter
  control — chỉ guild/member row lọc canvas.
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

- **Tab Cứ điểm:** mở expand của một đảo = focus đảo trên map — camera pan +
  đảo thành selected (highlight node; panel **giữ nguyên ở bảng**, không tự
  nhảy sang tab chi tiết — owner chốt 2026-10-26; muốn NodeDetails thì tự bấm
  tab Cứ điểm của panel). Bỏ nút "Xem đảo trên map". Chỉ focus khi toggle mở,
  không focus khi đóng.
- **Tab Cá nhân:** đảo trong expand của player chỉ liệt kê + điểm — **bỏ focus**
  (trả lại vai focus cho tab Cứ điểm, tránh hai nơi cùng điều khiển camera).

### Nhãn chung + filter mode

- Label "TOÀN CHIẾN TRƯỜNG" đang lặp trong cả 3 board — move lên thành **header
  chung của panel BXH** (trên board tabs), kèm một checkbox **"Filter mode"**
  (default tick).
- **Tick (filter mode, mặc định):** đúng mô hình accordion = filter bên trên —
  một expansion tại một thời điểm, mở = lọc canvas, member toggle player↔guild.
- **Bỏ tick (xem tự do):** tắt chế độ filter của BXH — panel thuần đọc. Expand
  thoải mái nhiều guild / player / faction cùng lúc, member trong guild chỉ
  hiển thị (không toggle filter). BXH không side-effect gì lên canvas; tắt
  mode thì canvas reset về `all`.
- Mode này là state của panel — **không reset khi đổi tab BXH** (khác với
  filter/expansion). Focus-on-expand ở tab Cứ điểm giữ nguyên hành vi trong
  cả 2 mode (camera theo lần expand cuối là hành vi mong đợi).

### Legend đáy canvas — display-only

- Legend chỉ còn show màu/label các phe, **bỏ hết hành vi filter**.
- Filter phe drop hoàn toàn (owner chốt 2026-10-26): sau khi legend
  display-only, sub-tab BXH Phe là điểm filter phe cuối cùng còn lại — và nó
  cũng bị tước. Không còn điểm nào lọc canvas theo phe.
- Hệ quả chấp nhận: mất luôn dim-theo-owner trên canvas; data layer bỏ case
  neutral trong filter (owner hiển thị trên node vẫn tính riêng, không đụng
  filter).

## Roadmap sub-specs

| # | Sub-spec | Scope | Phụ thuộc |
|---|----------|-------|-----------|
| 01 | [`next/01-filter-engine.md`](next/01-filter-engine.md) | Union filter + match theo kind, index guild/player, `GuildScore` members, chip overlay, legend display-only | — |
| 02 | [`next/02-bxh-phe-drilldown.md`](next/02-bxh-phe-drilldown.md) | Header chung + checkbox Filter mode + accordion guild tab Phe + reset view | 01 |
| 03 | [`next/03-canhan-focus.md`](next/03-canhan-focus.md) | Tab Cá nhân accordion + vai focus (Cứ điểm focus-on-expand, bỏ focus player) | 01 (nên sau 02) |

Thứ tự gợi ý: 01 → 02 → 03. Mỗi sub-spec một nhịp implement/review riêng.
