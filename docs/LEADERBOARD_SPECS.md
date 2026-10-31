# Leaderboard & Canvas Filter Specs (Bảng Xếp Hạng & Lọc Canvas)

> Tài liệu đặc tả mô hình bảng xếp hạng (BXH), cơ chế lọc bản đồ (filter canvas) và quy tắc tương tác UI/UX trên web frontend.
> Hợp đồng hành vi đã thống nhất với chủ dự án, kế thừa và làm rõ cấu trúc event từ [docs/sea/SEA_STRUCTURE.md](sea/SEA_STRUCTURE.md) §3.2.

---

## 1. Bối cảnh: In-game vs Web Frontend

### 1.1. Bảng xếp hạng trong game (nguồn gốc)

Theo ghi nhận từ capture thực tế ([docs/sea/SEA_STRUCTURE.md](sea/SEA_STRUCTURE.md) §3.2, §3.3, §3.7):

- **Giao diện game chỉ có 2 tab:** "XH Phe" (xếp hạng 4 phe) và "XH điểm" (BXH cá nhân top-K).
- **Node leaderboard:** Mỗi cứ điểm có một popup BXH riêng (top-N người chơi gây Điểm ST tại cứ điểm đó).
- **Tổng quan phe:** mỗi phe một trang, mỗi guild một dòng kèm tổng Điểm ST của guild (§3.4).

### 1.2. Web Frontend tổng hợp & thứ tự tab

Web frontend tái cấu trúc dữ liệu thành **3 tab** theo thứ tự:
$$\text{Phe} \longrightarrow \text{Cá nhân} \longrightarrow \text{Cứ điểm}$$

- **Tab Phe:** Đưa lên đầu vì là góc nhìn chiến thuật tổng quan quan trọng nhất; có sub-tab "Chung" + 4 phe, drill-down từ Phe → Guild → Thành viên.
- **Tab Cá nhân:** Theo dõi phân bố đóng góp của các top player toàn bản đồ.
- **Tab Cứ điểm:** Danh sách các đảo (không gồm căn cứ), mặc định theo số đảo (`1-1 → 1-2 → … → 2-x → trung tâm`); lọc theo phe đang chiếm và sort theo tổng Điểm ST (§2.3).

Vào app panel mở sẵn tab Xếp hạng, board Phe.

### 1.3. Nguồn dữ liệu & Giới hạn đối chiếu

Contract: **mỗi tab dùng đúng bảng server của tab đó**, chỉ những chỗ server không có dữ liệu mới derive từ node boards (board 118). Tự cộng điểm từ node boards làm lệch thứ tự so với game nên không dùng cho số liệu chính.

- **Tab Cá nhân:** rows = **board 117 của server** (BXH điểm, top-200: rank, player id, điểm, phe từ `additionInfo`; dump `playerBoard`). Không tự cộng điểm. Phần **expand** ("player này contribute vào đâu") mới match node boards 118 theo player id — node board là top-N/node nên đảo có thể thiếu nếu player không lọt top-N.
- **Tab Phe:** guild rows + điểm guild = bảng **"Tổng quan phe"** của server (dump `factionGuilds`, key theo `guildId`); board 116 chỉ trả 4 row phe nên không đủ cho guild. Điểm phe = tổng điểm các guild row. Lực chiến guild lấy từ guild brief, thiếu thì cộng LC của member. **Duy nhất** danh sách thành viên trong guild expand được derive từ node boards (match guild qua `guildId` trong brief của member); player không có `guildId` hoặc `guildId` không có row server rơi vào bucket **"Không guild"**. Cột nhiên liệu + highlight: dòng phe hiển thị `X đảo | Y (nhiên liệu)` — nhiên liệu = bảng **BXH Phe của game** (dump `fuel`, `0x72/0x001c`); phe nhiên liệu cao nhất được highlight viền trái (`rankFactionsForHighlight`), dump thiếu `fuel` thì ẩn cột và highlight fallback theo lực chiến. Số hạng đầu row vẫn là thứ hạng theo Điểm phe.
- **Tab Cứ điểm:** điểm từng phe tại node, tổng, % phe dẫn và ngưỡng chiếm = **node state `0x72/0x0012` của server** (dump `nodeFactionScores`); NodeDetails và popup trên canvas dùng cùng số này. Danh sách player khi expand là **board 118 per-node** nên ở node bị cắt Σ điểm player < điểm phe. Dump không có `nodeFactionScores` thì FE cộng board 118 (thấp hơn thật ở node đông).
- **Giới hạn đã biết:** server cắt top-20/node (verify:
  [SOCKET_PROTOCOL.md](sea/SOCKET_PROTOCOL.md) §3.5), top-200 global; player/guild
  ngoài ngưỡng không có dữ liệu, chấp nhận lệch (intent §5). 16 player S513/S514
  server không trả brief. Guild không member nào có brief hiển thị tên `#<guildId>`.

### 1.4. Tên phe & màu

- **Không dùng hướng** (Đông/Tây/Nam/Bắc) ở bất kỳ text UI nào. Tên phe = **tên đầy đủ của base in-game**. `id` nội bộ (`east`/`south`/`north`/`west`) giữ nguyên, chỉ là khoá dữ liệu.
- **Thứ tự hiển thị cố định** (pill sub-tab Tab Phe, pill lọc Tab Cứ điểm, list "Chung", legend chân canvas): **Vịnh Thao Thiết → Long Khư U Ám → Thần Tự Lấp Lánh → Thánh Đảo Lạnh Giá**. List phe không sort lại theo điểm; số hạng ở đầu row vẫn là thứ hạng theo Điểm phe.
- **Hai field màu** mỗi phe ([`src/data/factions.ts`](../src/data/factions.ts)), tách riêng để có thể đổi độc lập; Owner chốt (2026-10-29) hiện dùng **chung một giá trị** cho cả hai:
  - `color` — edge, swatch, viền đảo, icon căn cứ, bar điểm, tint row.
  - `labelColor` — **mọi text label tên phe**: pill, row BXH, legend chân canvas (swatch dùng `color`, text dùng `labelColor`), tooltip node, tag chủ đảo, dòng phe của player.

| Phe (base)         | `id`    | `color` = `labelColor` | Icon (`lucide-react`) |
| ------------------ | ------- | ---------------------- | --------------------- |
| Vịnh Thao Thiết    | `east`  | xanh lam `#1e9cf0`     | `ZodiacAries`         |
| Long Khư U Ám      | `south` | cam `#e8590c`          | `Flame`               |
| Thần Tự Lấp Lánh   | `north` | vàng `#e6ad00`         | `Sparkles`                 |
| Thánh Đảo Lạnh Giá | `west`  | tím `#8e44d8`          | `Snowflake`           |

`color` dùng chung cho swatch/viền đảo/bar điểm, trừ edge connection trên canvas đọc `edgeColor` trước (`faction.edgeColor ?? faction.color`): phe vàng đậm hơn một bậc (`#cc9a00`) vì màu chuẩn bị chìm ở opacity 0.7 trên nền giấy canvas; các phe còn lại dùng `color`.

- **Icon đại diện phe ([`src/components/shared/factionIcons.ts`](../src/components/shared/factionIcons.ts)):**
  - **Base nodes trên canvas:** 4 căn cứ phe hiển thị icon tương ứng của phe (`ZodiacAries`, `Flame`, `Sparkles`, `Snowflake`), các đảo thường giữ icon mỏ neo (`Anchor`), đảo trung tâm giữ icon thành trì (`Castle`). Badge header tại panel chi tiết ([`NodeDetails`](../src/components/panels/NodeDetails/index.tsx)) cũng hiển thị icon phe này khi chọn căn cứ.
  - **Avatar người chơi ([`PlayerIdentity`](../src/components/shared/PlayerIdentity.tsx)):** BXH cá nhân (và bảng người chơi) dùng icon phe với màu `labelColor` trên nền nhạt làm avatar thay vì chữ cái đầu tên player.
  - **BXH Phe ([`FactionBoard`](../src/components/panels/leaderboard/FactionBoard.tsx)):** Cờ/avatar đại diện phe dùng icon phe với màu `labelColor` trên nền nhạt thay vì chữ cái đầu tên phe.
  - **Legend chân canvas ([`FactionLegend`](../src/components/map/map-footer/FactionLegend.tsx)):** Hiển thị icon tương ứng của phe thay vì ô vuông màu.

### 1.5. Tên đảo hiển thị

- `_name` của camp in-game dính sẵn display-id (`"1-15Đảo Xích Đu"`, `"Khu nghỉ dưỡng Trường Đảo 3-2"`). Frontend **bỏ token id khỏi tên** (`displayNameOf` trong [`src/data/sea-live/join.ts`](../src/data/sea-live/join.ts)) và tự ghép id riêng khi cần → `1-15 Đảo Xích Đu`, không lặp `1-15 1-15Đảo…`.

---

## 2. Mô hình tương tác (Interaction Contract)

### 2.1. Filter là một (Single Filter State) — Không filter theo phe

- Canvas bản đồ chỉ có **một filter tại một thời điểm**:
  $$\text{Filter} \in \{\text{null (all)}, \text{guild(guildId)}, \text{player(id)}\}$$
- Guild filter dùng `guildId` của game làm identity (hai guild cùng tên vẫn tách biệt); bucket "Không guild" dùng chính chuỗi `"Không guild"`.
- **Không có filter theo phe (Owner chốt 2026-10-26):** highlight phe trên canvas không đem lại nhiều giá trị chiến thuật. Bản đồ tập trung vào highlight node theo đóng góp của Guild hoặc Player.
- **Hiển thị khi filter bật:** node có đóng góp của guild/player được highlight, node còn lại bị dim; guild/player không có trong index → mọi node dim. Edge không highlight theo filter — toàn bộ edge chỉ bị dim (edge phe opacity 0.2, edge trung lập 0.12) để node được highlight nổi lên. Không filter → edge ở trạng thái nghỉ (edge phe 0.7, trung lập theo opacity cấu hình).
- **Legend chân canvas:** **display-only** (swatch `color` + tên phe `labelColor`), không có tương tác lọc.

### 2.2. Filter Mode (Header chung của BXH)

- Trên đỉnh panel BXH có header chung gồm eyebrow `"TOÀN CHIẾN TRƯỜNG"` và checkbox **`"Filter mode"`** (mặc định: bật).
- **Khi bật Filter mode (mặc định):**
  - Accordion đồng bộ với Filter: Mở một guild/player đồng nghĩa với việc lọc canvas theo mục đó.
  - Mỗi cấp chỉ một mục mở tại một thời điểm (một phe, một guild, một player).
- **Khi tắt Filter mode (Xem tự do):**
  - Tắt checkbox gọi `resetRankingView()` — canvas về `all`, đóng hết accordion.
  - Tab Phe / Cá nhân dùng `<details>` đa mở tự do; member trong guild chỉ hiển thị, không bấm được.
  - Thao tác trên BXH không gây side-effect lên canvas.
- **Tab Cứ điểm không phụ thuộc Filter mode** — hành vi giống nhau ở cả hai mode (§2.3).
- **Trạng thái lưu trữ:** `filterMode` là state của panel ([`src/stores/panel.ts`](../src/stores/panel.ts)), **không bị reset** khi chuyển tab BXH, đổi cụm hay đổi ngày.
- **Đổi cụm / ngày:** đổi cụm server (server switcher, `selectServer`) gọi `resetRankingView()` — filter canvas về all + đóng hết accordion (guild/player cụm cũ không còn nghĩa). Đổi ngày (thanh Lịch sử, `selectDay`) **không reset**: guildId/playerId ổn định trong cùng cụm nên filter vẫn áp lên data ngày mới.

### 2.3. Quy tắc chi tiết từng Tab

#### Tab Phe (Drill-down: Phe → Guild → Thành viên)

- **Sub-tab Phe (Chung + 4 phe):** thuần túy là bộ lọc góc nhìn panel (view-local, state local của board), không tác động lên canvas ở cả 2 mode. Pill phe dùng tên đầy đủ, text + tint theo `labelColor`, thứ tự cố định (§1.4). Bấm lại pill đang chọn → về "Chung". Sub-tab một phe hiển thị card phe (viền `color`) + danh sách guild của phe đó.
- **Checkbox "Sắp xếp Bang theo điểm"** (mặc định tắt, state local của board): tắt → guild sort theo Lực chiến giảm dần (hoà thì theo điểm); bật → sort theo Điểm ST giảm dần. Bucket "Không guild" sort chung với các guild khác.
- **Row phe (view "Chung"):** số hạng theo Điểm phe; phe dẫn đầu nhiên liệu có viền trái màu phe (`rankFactionsForHighlight` — dump thiếu `fuel` thì fallback theo lực chiến). Nội dung 3 dòng: tên phe / `M guild [tổng LC]` / `N đảo | Y (nhiên liệu)` (đảo đang chiếm; dump thiếu `fuel` thì chỉ `N đảo`). Tổng LC = tổng LC các guild trong phe, cùng format tag `[LC]` của guild; `[—]` khi chưa có power data. Tiêu đề board kèm tổng điểm ST của 4 phe cạnh phải.
- **Mở/đóng row phe (filter mode):** accordion một phe tại một thời điểm, thuần view — không filter canvas. Ngoại lệ: nếu thao tác làm guild đang mở biến mất khỏi view (đóng phe chứa guild đó, hoặc mở phe khác) → reset view toàn phần (filter về all) rồi mới mở phe mới.
- **Row guild:** 2 dòng `Tên guild [LC]` / `P người · N đảo` (luôn hiển thị; `[—]` khi guild brief rỗng và không member nào có power). Điểm guild là điểm server.
- **Click Guild row (filter mode):** mở danh sách thành viên (sort theo điểm giảm dần), đồng thời filter canvas theo guild:
  - Highlight toàn bộ các node mà thành viên trong guild có đóng góp.
  - Row guild đang mở được tint nhẹ màu phe.
  - Chỉ một guild được mở tại một thời điểm. Đóng guild → filter canvas về `all`, phe chứa guild vẫn giữ mở.
- **Click Member row (trong guild đang mở):**
  - Lần 1: Chuyển filter canvas sang cá nhân người chơi đó (highlight chỉ những node người này đánh). Member được chọn tint đậm hơn trong list.
  - Lần 2 (click lại chính người đó): Quay lại filter theo guild cha. Guild vẫn giữ trạng thái mở.

#### Tab Cá nhân (Accordion theo Player)

- Thứ tự + điểm theo board 117 của server; số hạng đầu row luôn là hạng server (board 117), không đổi theo sort. Hai dòng `Tên | LC` / `Bang · N đảo` — dòng tên chữ đen, dòng dưới tint `labelColor` như cũ; không lặp tên phe (màu thể hiện phe); LC lấy từ brief (`dump briefs.power`), player không brief thì chỉ tên. Checkbox **"Sắp xếp theo lực chiến"** (mặc định tắt, state local — tự reset khi rời board): bật = LC giảm dần (player không LC chạm đáy, giữ thứ tự server), tắt = thứ tự server.
- Filter mode: accordion, mỗi thời điểm chỉ mở tối đa 1 player. Mở một player = filter canvas theo player đó (dùng chung logic filter với khi click member ở Tab Phe). Đóng player đang mở → reset view toàn phần.
- Danh sách đảo trong phần expand của player là **row tĩnh** (`Đảo <id>` + điểm đóng góp), **không điều khiển camera pan**. Player không lọt top-N node nào thì expand rỗng.

#### Tab Cứ điểm (Phân vai camera focus duy nhất)

- **Không phụ thuộc Filter mode**, không đụng filter canvas. State local của board (pill lọc, sort) — rời board là reset.
- **Tiêu đề** đếm số cứ điểm đang hiển thị: `Xếp hạng cứ điểm (N)`.
- **Pill lọc theo phe chiếm:** `Tất cả` + 4 phe (thứ tự cố định, text theo `labelColor`) + `Chưa chiếm` (đảo trung lập — owner server rỗng). Bấm lại pill đang chọn → về `Tất cả`.
- **Thứ tự mặc định:** theo số đảo (`1-1, 1-2, …, 1-n, 2-1, …`, trung tâm cuối) — so từng đoạn số, không so chuỗi. Nút **"Sắp xếp theo điểm"** xoay vòng theo tổng Điểm ST: không sort → tăng dần → giảm dần → không sort.
- **Row đảo:** `<id> <tên đảo>` / `K phe · <điểm phe cao nhất> (x%)` (màu `labelColor` của phe đó, % so với tổng điểm đảo, làm tròn xuống). Đảo trung lập thì nối thêm `/ <claimThreshold>`; đảo chưa có điểm chỉ hiển thị `/ <claimThreshold>`. Đảo có owner được tint màu phe chủ (nền nhạt + viền trái).
- **Expand đảo:** điểm từng phe (phe có điểm > 0) + bảng người chơi tấn công (top-N của node board).
- **Mở expand = focus đảo trên canvas** (camera pan mượt tới đảo + đảo thành selected). Đa mở được — camera theo lần expand cuối. Panel **giữ nguyên ở bảng xếp hạng**, không tự chuyển sang tab "Cứ điểm" chi tiết.
- **Đóng expand** không focus; nếu đảo đó đang selected thì gỡ selection, đảo khác đang selected thì giữ nguyên.

### 2.4. Quy tắc Reset View

`resetRankingView()` đưa filter canvas về `all` và đóng toàn bộ expansion (phe, guild, member, player). Được gọi khi:

1. Chuyển đổi giữa các tab BXH (Phe ↔ Cá nhân ↔ Cứ điểm).
2. Rời khỏi panel Xếp hạng: bấm tab Cứ điểm trên thanh điều hướng, click đảo trên canvas (mở chi tiết đảo), hoặc chọn một kết quả tìm kiếm.
3. Tắt Filter mode.
4. Đổi cụm server.
5. Đóng player đang mở (Tab Cá nhân), hoặc thao tác phe làm guild đang mở biến mất khỏi view (§2.3).

Đóng guild đang mở **không** reset toàn phần: chỉ gỡ filter + thu guild, phe vẫn mở.

_(Checkbox `filterMode` luôn giữ nguyên giá trị đã chọn.)_

### 2.5. Chip Overlay góc canvas

- Khi có filter guild hoặc player đang hoạt động, góc trên canvas hiển thị chip trạng thái: icon kiếm (guild) hoặc icon người (player) + tên + nút `✕`.
- Tên guild tra từ `guildNames` theo `guildId`; tên player tra từ danh sách player; không tìm thấy thì hiển thị id.
- Bấm `✕` trên chip hủy filter, đưa canvas về `all`. Accordion BXH không bị đóng theo.

---

## 3. Kiến trúc Code & Ánh xạ triển khai

| Tầng / File                                                                                             | Trách nhiệm triển khai                                                                                                                                                                                                       |
| :------------------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/types.ts`](../src/types.ts)                                                                       | `interface MapFilter { kind: "guild" \| "player"; id: string }` (alias `CanvasFilter`), `FactionBoardEntry`, `GuildScore`, `GuildMember`.                                                                                    |
| [`src/stores/mapView.ts`](../src/stores/mapView.ts)                                                     | State `filter: MapFilter \| null` + `setFilter`, `toggleFilter`, `resetFilter`; kèm `showAll` (toggle "Điểm toàn map").                                                                                                      |
| [`src/stores/panel.ts`](../src/stores/panel.ts)                                                         | `tab`, `board`, `query`, `filterMode: boolean`, state expansion (`openFaction`, `openGuild`, `selectedMember`, `openPlayer`).                                                                                                 |
| [`src/stores/commands.ts`](../src/stores/commands.ts)                                                   | Gom các tương tác đa store: `setPanelTab`, `openIsland`, `setRankingBoard`, `setFilterMode`, `resetRankingView`, `toggleFactionView`, `toggleGuildFilter`, `selectGuildMember`, `togglePlayerFilter`, `resetCanvasFilter`. |
| [`src/stores/dataset.ts`](../src/stores/dataset.ts)                                                     | Giữ bộ data đang xem (cụm × ngày); `selectServer` reset view BXH, `selectDay` giữ nguyên filter.                                                                                                                             |
| [`src/domain/selectors/board/`](../src/domain/selectors/board/)                                         | `buildFactionBoard` + `rankFactions` (Tab Phe), `rankFactionsForHighlight` (highlight phe dẫn đầu nhiên liệu, fallback lực chiến), `buildGuild` + `sortGuilds` + `NO_GUILD` (guild/member), `buildServerLeaderboard` (Tab Cá nhân), `buildNodeBoard` (Tab Cứ điểm, thứ tự số đảo).                              |
| [`src/domain/mapData.ts`](../src/domain/mapData.ts)                                                     | `buildMapData(dump)` dựng các board + index `nodeIdsByGuild` / `nodeIdsByPlayer` và `guildNames`, `players` cho chip; component đọc qua `useMapData()`.                                                                     |
| [`src/domain/mapGraph.ts`](../src/domain/mapGraph.ts)                                                   | `matchNodeIds` (filter → tập node highlight), dim/highlight node trong `buildMapNodes`, dim toàn bộ edge khi filter bật trong `buildMapEdges`.                                                                              |
| [`src/hooks/useFocusIsland.ts`](../src/hooks/useFocusIsland.ts)                                         | `useFocusIslandOnBoard` — camera pan + select đảo từ Tab Cứ điểm, panel giữ nguyên.                                                                                                                                        |
| [`src/components/map/FilterChip.tsx`](../src/components/map/FilterChip.tsx)                             | Chip overlay hiển thị filter hiện tại và nút đóng `✕`.                                                                                                                                                                       |
| [`src/components/map/map-footer/FactionLegend.tsx`](../src/components/map/map-footer/FactionLegend.tsx) | Legend display-only.                                                                                                                                                                                                         |
| [`src/components/panels/leaderboard/`](../src/components/panels/leaderboard/)                           | `Leaderboard` (header + tab), `FactionBoard`, `GuildAccordion` (`GuildList`, member list), `PlayerBoard`, `NodeBoard`.                                                                                                       |
