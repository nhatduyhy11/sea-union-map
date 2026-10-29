# Connection UI Backlog — Tab Cứ điểm (NodeBoard)

## 1. Trạng thái của tài liệu

Ghi lại các scenario ownership / đường nối có thể xảy ra và hành vi **hiện tại** của tab Cứ điểm
([`NodeBoard.tsx`](../src/components/panels/leaderboard/NodeBoard.tsx)) với từng scenario, để chủ dự án review trước khi sửa code.
Rule gốc nằm ở [SEA_EVENT_RULE.md](SEA_EVENT_RULE.md); tài liệu này không thay đổi rule.

**Trạng thái:** chờ review. `NodeBoard.tsx` giữ nguyên cho tới khi các điểm mở ở §5 được chốt.

## 2. Nguồn dữ liệu liên quan

| Dữ liệu | Nguồn | Ghi chú |
| --- | --- | --- |
| `entry.owner` | Server snapshot (`dump.owner`, [`join.ts`](../src/data/sea-live/join.ts)) | Truth — server đã áp rule ngắt đường / tie. FE không tự contest ([`mapData.ts`](../src/domain/mapData.ts)). |
| `entry.scores` | `scoresForNode` ([`nodeScores.ts`](../src/domain/selectors/nodeScores.ts)) | Điểm **thô** của mọi phe (kể cả 0), không có cờ `connected`. |
| `connected` | `deriveConnected` ([`claims.ts`](../src/domain/claims.ts)) | FE tự derive từ owner + route. Chỉ NodeDetails dùng (`FactionScore.connected`); `buildNodeBoard` **không** nhận. |

## 3. Logic UI hiện tại

`reachedClaim(entry)` = điểm **thô** của phe cao nhất ≥ `claimThreshold` (không xét ngắt đường).

| Phần UI | Điều kiện hiện tại |
| --- | --- |
| Pill phe X | `entry.owner?.id === X` |
| Pill "Chưa chiếm" | `!reachedClaim(entry)` |
| Tô màu row | `reachedClaim ? owner?.color : không tô` |
| `TopShare` (điểm + % phe cao nhất, màu phe đó) | `total > 0`; phe cao nhất tính theo điểm thô |
| `ClaimNeed` ("/ ngưỡng") | `!reachedClaim` |

Hai tiêu chí khác nhau: pill phe dùng **owner (server)**, pill "Chưa chiếm" dùng **điểm thô**.

## 4. Scenario

Ký hiệu: ✅ đúng mong đợi · ❌ sai/lọt · ⚠️ đúng số liệu nhưng dễ gây hiểu nhầm · ❓ chưa rõ mong đợi.

| # | Scenario | owner | reachedClaim | Pill phe | "Chưa chiếm" | Tô màu | Hiển thị điểm | Đánh giá |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S1 | Chưa phe nào đánh (total = 0) | — | false | — | có | không | `/ ngưỡng` | ✅ |
| S2 | A, B cùng đánh, cả hai < ngưỡng | — | false | — | có | không | top + `/ ngưỡng` | ✅ |
| S3 | A ≥ ngưỡng, còn nối base → A chiếm | A | true | A | không | A | top A | ✅ |
| S4 | A ≥ ngưỡng nhưng bị cắt đường (§4), B < ngưỡng | — | true | — | **không** | không | top A, **không** có `/ ngưỡng` | ❌ đảo chỉ thấy ở "Tất cả" |
| S5 | A, B ≥ ngưỡng nhưng đều bị ngắt, C < ngưỡng | — | true | — | **không** | không | top A/B, không `/ ngưỡng` | ❌ như S4 |
| S6 | A, B ≥ ngưỡng, đều còn nối, hoà điểm tuyệt đối | — (theo FE, §8 chưa chốt) | true | — | **không** | không | top A hoặc B | ❌ như S4; ❓ hành vi server chưa xác nhận |
| S7 | A điểm cao nhất nhưng bị ngắt; B ≥ ngưỡng, còn nối → B chiếm | B | true | B | không | B | `TopShare` hiện điểm + màu **A** trên row màu **B** | ⚠️ không có hint A đang bị ngắt |
| S8 | A đang chiếm nhưng chính A bị cắt đường về base (B chiếm node trung gian sau đó) | A? | true | A | không | A | top A | ❓ server giữ owner A hay trả về trung lập? UI không có hint |
| S9 | A đang chiếm nhưng điểm thô A tại node < ngưỡng (owner giữ từ trước / data lệch) | A | false | A | **có** | không | `/ ngưỡng` | ❓ có xảy ra không? Nếu có: đảo hiện ở **cả** pill A và "Chưa chiếm", row không tô màu |
| S10 | Snapshot lệch: owner server khác kết quả FE suy ra từ điểm + connected | ? | ? | theo owner | theo điểm | ? | ? | ❓ lag crawl; cần quyết định tin nguồn nào |

## 5. Điểm còn mở (cần chủ dự án chốt)

1. **Định nghĩa "Chưa chiếm"**: `!owner` (khớp trạng thái game, gom S4–S6) hay "chưa phe nào đủ điểm hợp lệ" (cần cờ `connected`, vẫn lệch ở S6)? Hay tách thêm pill riêng cho nhóm "đủ điểm nhưng chưa chiếm" (S4–S6)?
2. **Tie (S6)**: server xử lý thế nào? (SEA_EVENT_RULE §8 ghi là chưa chốt.)
3. **Owner bị cắt đường (S8)**: server có tự gỡ owner không? Nếu không, UI có cần hint không?
4. **S9 có xảy ra không**: owner có tồn tại khi điểm thô < ngưỡng (vd. owner kế thừa, reset điểm)?
5. **Hint ngắt đường trên board (S4, S5, S7)**: có cần truyền `connectedByNode` vào `buildNodeBoard` để đánh mờ / gắn "ngắt" như NodeDetails không?
6. **Tô màu row / `ClaimNeed`**: nên theo `owner` hay theo `reachedClaim`? (S4: điểm vượt ngưỡng nhưng không hiện `/ ngưỡng`, người xem không biết vì sao chưa chiếm.)

## 6. Việc liên quan (sau khi chốt §5)

- Sửa điều kiện filter / tô màu / `ClaimNeed` trong `NodeBoard.tsx` theo quyết định §5.
- Đưa `topScore` / trạng thái claim xuống selector `buildNodeBoard` để có test cho các scenario S1–S9.
- Refactor tách component `NodeBoard` (filter pills, nút sort, row) — thuần cấu trúc, làm sau phần logic.
- Comment lỗi thời: `nodeBoard.ts` còn nhắc "checkbox"; `LEADERBOARD_SPECS.md` dòng Tab Cứ điểm còn ghi checkbox "Sort theo Điểm" (đã đổi thành nút xoay vòng).
