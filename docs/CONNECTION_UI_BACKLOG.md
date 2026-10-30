# Connection UI Backlog — Tab Cứ điểm (NodeBoard)

## 1. Trạng thái của tài liệu

Ghi lại hành vi tab Cứ điểm
([`NodeBoard.tsx`](../src/components/panels/leaderboard/NodeBoard.tsx)) với các scenario ownership / ngắt đường,
và các điểm còn mở. Rule gốc nằm ở [SEA_EVENT_RULE.md](SEA_EVENT_RULE.md); tài liệu này không thay đổi rule.

**Chốt (chủ dự án 2026-10-30):** ownership theo **owner server**. Server trả một owner/node đã áp rule ngưỡng,
ngắt đường; FE không tự tính đường nối hay contest (SEA_EVENT_RULE §8).

## 2. Nguồn dữ liệu

| Dữ liệu | Nguồn | Ghi chú |
| --- | --- | --- |
| `entry.owner` | Server snapshot `0x72/0x000c` (`dump.owner`, [`join.ts`](../src/data/sea-live/join.ts)) | Một giá trị/node, truth. |
| `entry.scores` | `scoresForNode` ([`nodeScores.ts`](../src/domain/selectors/nodeScores.ts)) | Điểm **thô** của mọi phe (kể cả 0) do server tính (node state `0x72/0x0012`, dump `nodeFactionScores`); dump thiếu key thì cộng board 118. Gồm cả điểm phe đang bị ngắt. |

## 3. Logic UI hiện tại

| Phần UI | Điều kiện |
| --- | --- |
| Pill phe X | `entry.owner?.id === X` |
| Pill "Chưa chiếm" | `!entry.owner` |
| Tô màu row | màu `entry.owner` (trung lập: không tô) |
| `TopShare` (điểm + % phe điểm cao nhất, màu phe đó) | `total > 0`; phe cao nhất theo điểm thô |
| `ClaimNeed` ("/ ngưỡng") | `!entry.owner` |

NodeDetails: tag owner, cạnh ngưỡng chiếm hiện điểm của owner (node trung lập chỉ hiện ngưỡng).

## 4. Scenario

Ký hiệu: ✅ đúng mong đợi · ⚠️ đúng số liệu nhưng dễ gây hiểu nhầm.
Cột "Gặp" là số lần quan sát ở 9 crawl 2026-10-29/30 (cụm 517, 590; ~85 node/crawl).

| # | Scenario | Gặp | Hiển thị | Đánh giá |
| --- | --- | --- | --- | --- |
| S1 | Không phe nào đủ ngưỡng | 119 | "Chưa chiếm", không tô, `/ ngưỡng` | ✅ |
| S2 | Owner = phe điểm cao nhất, đủ ngưỡng, còn nối | 630 | pill + tô màu owner, `TopShare` owner | ✅ |
| S3 | Phe đủ ngưỡng nhưng mọi phe đủ ngưỡng đều bị ngắt → trung lập | 6 | "Chưa chiếm", không tô; `TopShare` hiện phe bị ngắt + `/ ngưỡng` | ✅ |
| S4 | Phe điểm cao nhất bị ngắt; phe khác đủ ngưỡng, còn nối → chiếm | 10 | row màu owner, `TopShare` hiện điểm + màu **phe bị ngắt** | ⚠️ xem §5.1 |

Hoà điểm giữa các phe đủ điều kiện và owner bị cắt khỏi base: server quyết định,
FE hiển thị owner, không cần logic riêng; 0/765 trong 9 crawl.

## 5. Điểm còn mở

1. **`TopShare` ở S4**: giữ phe điểm cao nhất (hiện tại) hay đổi sang điểm của owner để row nhất quán? Chưa chốt.

## 6. Việc liên quan

- Refactor tách component `NodeBoard` (filter pills, nút sort, row) — thuần cấu trúc.
- Comment lỗi thời: `nodeBoard.ts` còn nhắc "checkbox"; `LEADERBOARD_SPECS.md` dòng Tab Cứ điểm còn ghi checkbox "Sort theo Điểm" (đã đổi thành nút xoay vòng).
