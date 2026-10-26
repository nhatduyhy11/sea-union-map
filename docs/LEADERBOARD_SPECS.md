# Leaderboard & Canvas Filter Specs (Bảng Xếp Hạng & Lọc Canvas)

> Tài liệu đặc tả mô hình bảng xếp hạng (BXH), cơ chế lọc bản đồ (filter canvas) và quy tắc tương tác UI/UX trên web frontend.
> Hợp đồng hành vi đã thống nhất với chủ dự án (2026-10-26), kế thừa và làm rõ cấu trúc event từ [docs/SEA_STRUCTURE.md](SEA_STRUCTURE.md) §3.2.

---

## 1. Bối cảnh: In-game vs Web Frontend

### 1.1. Bảng xếp hạng trong game (nguồn gốc)
Theo ghi nhận từ capture thực tế ([docs/SEA_STRUCTURE.md](SEA_STRUCTURE.md) §3.2, §3.3, §3.7):
- **Giao diện game chỉ có 2 tab:** "XH Phe" (xếp hạng 4 phe) và "XH điểm" (BXH cá nhân top-K).
- **Node leaderboard:** Mỗi cứ điểm có một popup BXH riêng (top-N người chơi gây Điểm ST tại cứ điểm đó).

### 1.2. Web Frontend tổng hợp & thứ tự tab
Web frontend tái cấu trúc dữ liệu thành **3 tab** theo thứ tự:
$$\text{Phe} \longrightarrow \text{Cá nhân} \longrightarrow \text{Cứ điểm}$$
- **Tab Phe:** Đưa lên đầu vì là góc nhìn chiến thuật tổng quan quan trọng nhất; có sub-tab "Chung" + 4 phe, drill-down từ Phe → Guild → Thành viên.
- **Tab Cá nhân:** Theo dõi phân bố đóng góp của các top player toàn bản đồ.
- **Tab Cứ điểm:** Danh sách các đảo sắp xếp theo mức độ cạnh tranh (tổng Điểm ST).

### 1.3. Nguồn dữ liệu & Giới hạn đối chiếu
- **Nguồn chân lý data:** Toàn bộ thống kê guild/thành viên phía frontend được **derive từ per-node leaderboard toàn map** (gộp các dòng `Contribution[]` của 89 cứ điểm, xem [`domain/selectors.ts`](../src/domain/selectors.ts)), **không dùng BXH cá nhân top-K** của server game.
- **Chấp nhận độ lệch (Owner chốt 2026-10-26):** Node leaderboard là top-N mỗi node nhưng gộp cả map nên có độ phủ rộng hơn top-K cá nhân của server. Dùng nó để thống kê lại là chủ ý kiến trúc; không cần đối chiếu khớp hoàn toàn giữa tổng guild và tổng members hiển thị.

---

## 2. Mô hình tương tác (Interaction Contract)

### 2.1. Filter là một (Single Filter State) — Drop filter theo phe
- Canvas bản đồ chỉ có **một filter tại một thời điểm**:
  $$\text{Filter} \in \{\text{null (all)}, \text{guild(id)}, \text{player(id)}\}$$
- **Bỏ hoàn toàn filter theo phe (Owner chốt 2026-10-26):** Việc highlight phe và đổi màu edges trên canvas không đem lại nhiều giá trị chiến thuật. Bản đồ tập trung hoàn toàn vào cơ chế highlight node theo đóng góp của Guild hoặc Player.
- **Legend chân canvas:** Chuyển thành **display-only** (chỉ hiển thị swatch màu đại diện và tên phe), loại bỏ toàn bộ tương tác bấm để lọc. Các edge trên bản đồ luôn ở trạng thái nghỉ (`resting`).

### 2.2. Filter Mode (Header chung của BXH)
- Trên đỉnh panel BXH có header chung gồm eyebrow `"TOÀN CHIẾN TRƯỜNG"` và checkbox **`"Filter mode"`** (mặc định: bật).
- **Khi bật Filter mode (mặc định):**
  - Accordion đồng bộ với Filter: Mở một mục đồng nghĩa với việc lọc canvas theo mục đó.
  - Chỉ một thực thể được mở tại một thời điểm.
- **Khi tắt Filter mode (Xem tự do):**
  - BXH chuyển thành chế độ đọc thuần túy (dùng `<details>` đa mở tự do).
  - Người dùng có thể expand nhiều phe/guild/player cùng lúc để tra cứu số liệu.
  - Thao tác trên BXH không gây bất kỳ side-effect nào lên canvas (canvas giữ nguyên trạng thái `all`).
- **Trạng thái lưu trữ:** `filterMode` là state của panel ([`stores/panel.ts`](../src/stores/panel.ts)), **không bị reset** khi chuyển tab BXH.

### 2.3. Quy tắc chi tiết từng Tab

#### Tab Phe (Drill-down: Phe → Guild → Thành viên)
- **Sub-tab Phe (Chung + 4 phe):** Thuần túy là bộ lọc góc nhìn panel (view-local), không tác động lên canvas ở cả 2 mode.
- **Click Guild row:** Mở rộng danh sách thành viên của guild đó, đồng thời kích hoạt filter canvas theo guild:
  - Highlight toàn bộ các node mà thành viên trong guild có đóng góp.
  - Row guild được tint màu phe nhẹ và hiển thị số lượng đảo có đóng góp (`· N đảo`).
  - Chỉ một guild được mở tại một thời điểm. Đóng guild → reset canvas về `all`.
- **Click Member row (trong guild đang mở):**
  - Lần 1: Chuyển filter canvas sang cá nhân người chơi đó (highlight chỉ những node người này đánh). Member được chọn highlight đậm hơn trong list.
  - Lần 2 (click lại chính người đó): Quay lại filter theo guild cha. Guild vẫn giữ trạng thái mở.

#### Tab Cá nhân (Accordion theo Player)
- Áp dụng cùng mô hình accordion: Mỗi thời điểm chỉ mở tối đa 1 player.
- Mở một player = kích hoạt filter canvas theo player đó (dùng chung logic filter với khi click member ở Tab Phe).
- Danh sách đảo trong phần expand của player là **row tĩnh** (chỉ hiển thị tên đảo + điểm đóng góp), **không điều khiển camera pan**.

#### Tab Cứ điểm (Phân vai camera focus duy nhất)
- Mở expand của một đảo = **Focus đảo trên canvas map** (camera pan mượt tới đảo + đảo được chọn/highlight).
- Panel **giữ nguyên ở bảng xếp hạng**, không tự động chuyển sang tab "Cứ điểm chi tiết" (nếu muốn xem chi tiết đảo, người dùng tự bấm tab Cứ điểm trên thanh điều hướng).
- Loại bỏ nút "Xem đảo trên map". Chỉ kích hoạt focus khi toggle mở, không focus khi đóng.

### 2.4. Quy tắc Reset View
View và filter sẽ tự động reset về `all` và đóng toàn bộ expansion khi:
1. Chuyển đổi giữa các tab BXH (Phe ↔ Cá nhân ↔ Cứ điểm).
2. Rời khỏi panel Xếp hạng (chuyển sang tab Cứ điểm, click canvas đóng panel, hoặc tìm kiếm).
3. Người dùng chủ động collapse hàng đang mở.
*(Lưu ý: Checkbox `filterMode` vẫn giữ nguyên giá trị đã chọn).*

### 2.5. Chip Overlay góc canvas
- Khi có filter guild hoặc player đang hoạt động, góc trên canvas hiển thị chip trạng thái:
  - `[⚔ Tên Guild ✕]` hoặc `[👤 Tên Player ✕]`
- Bấm nút `✕` trên chip sẽ hủy filter và đưa canvas về trạng thái `all`.

---

## 3. Kiến trúc Code & Ánh xạ triển khai

| Tầng / File | Trách nhiệm triển khai |
| :--- | :--- |
| [`src/types.ts`](../src/types.ts) | Định nghĩa union `MapFilter = { kind: "guild" \| "player", id: string }`. |
| [`src/stores/mapView.ts`](../src/stores/mapView.ts) | Quản lý state `filter: MapFilter \| null`, các action `setFilter`, `toggleFilter`, `resetFilter`. |
| [`src/stores/panel.ts`](../src/stores/panel.ts) | Lưu `filterMode: boolean`, state expansion (`openGuild`, `selectedMember`, `openFaction`, `openPlayer`). |
| [`src/stores/commands.ts`](../src/stores/commands.ts) | Gom các tương tác đa store: `setRankingBoard`, `setFilterMode`, `resetRankingView`, `toggleGuildFilter`, `toggleMemberFilter`, `togglePlayerFilter`. |
| [`src/domain/selectors.ts`](../src/domain/selectors.ts) | Tính toán `GuildScore` kèm danh sách `members` (sort theo điểm) và số lượng đảo; gộp dữ liệu từ `Contribution[]`. |
| [`src/domain/mapData.ts`](../src/domain/mapData.ts) | Xây dựng index tra cứu nhanh `nodeIdsByGuild` và `nodeIdsByPlayer`. |
| [`src/domain/mapGraph.ts`](../src/domain/mapGraph.ts) | Áp dụng logic dim/highlight node dựa trên `matchNodeIds`; giữ edges luôn ở trạng thái resting. |
| [`src/components/map/FilterChip.tsx`](../src/components/map/FilterChip.tsx) | Chip overlay hiển thị filter hiện tại và nút đóng `✕`. |
| [`src/components/map/FactionLegend.tsx`](../src/components/map/FactionLegend.tsx) | Legend display-only, bỏ toàn bộ nút bấm lọc. |
| [`src/components/panels/leaderboard/`](../src/components/panels/leaderboard/) | Các component `FactionBoard`, `PlayerBoard`, `IslandBoard` thực thi accordion và filter mode. |
