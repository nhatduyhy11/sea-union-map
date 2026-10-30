# SEA_STATS_RECONCILE — Đối chiếu các nguồn "tổng điểm"

> Nguồn sự thật cho câu hỏi "tổng điểm X lấy từ đâu" trên Web UI. Ghi hiện trạng
> BE/FE, số đo đối chiếu và các điểm còn mở. Việc cần làm nằm ở
> [BACKLOG_SEA.BE.md §2](BACKLOG_SEA.BE.md).

## 1. Nguyên tắc (chủ dự án chốt 2026-10-30)

- Điểm player theo node (board 118) **chỉ để tham khảo**: server cắt top-20/node
  ([SOCKET_PROTOCOL.md](SOCKET_PROTOCOL.md) §3.5), node hot lệch lớn — chấp nhận
  ([PROJECT_INTENT.md §5](../PROJECT_INTENT.md)).
- Bất cứ chỗ nào hiển thị **tổng điểm của phe tại node** đều phải dùng số server
  (`0x72/0x0012`), không cộng board rows.

## 2. Các nguồn điểm

| Nguồn | Packet | Nội dung | Giới hạn |
| --- | --- | --- | --- |
| Node state | `0x72/0x0012` f2 `campHurtScores` | Điểm ST 4 phe tại 1 node, server tính | Đủ — không cắt |
| Node state | `0x72/0x0012` f5 `campScores` (double) | Chưa rõ nghĩa | Parser chưa đọc |
| Node board | `0x0c/0x0003` board 118 | Row player tại node: điểm + `campId` | Top-20/node, gộp mọi phe |
| BXH điểm | board 117 | Điểm tổng player toàn event | Top-200 |
| Tổng quan phe | `0x72/0x0025` | Điểm ST từng guild trong phe | Đủ guild |

## 3. Hiện trạng

### BE

- `parse_node_state` (`tools/socket_log/sea_socket/protocol.py`) đọc f2 thành
  `faction_scores`; crawler ghi `node-states.jsonl` và cộng thành
  `per_faction_scores` trong `summary.json`.
- `report.py` (`dump_run`) **không đọc `node-states.jsonl`** → JSON FE không có
  điểm phe theo node.

### FE

Mọi tổng node đi qua `scoresForNode` (`src/domain/selectors/nodeScores.ts`) =
Σ `nodeRows` theo phe:

| Chỗ hiển thị | Code | Nguồn hiện tại |
| --- | --- | --- |
| Popup điểm 4 phe trên canvas | `src/domain/mapData.ts` → `IslandNode/NodeStats.tsx` | Σ rows ❌ |
| Tab Cứ điểm: tổng, % phe dẫn, sort theo điểm | `selectors/board/nodeBoard.ts` | Σ rows ❌ |
| Tab Cứ điểm: pill "Chưa chiếm", tô màu row | `reachedClaim` / `topScore` trong `NodeBoard.tsx` | Σ rows so với `claimThreshold` ❌ |
| NodeDetails: điểm phe, tổng, phe dẫn | `selectors/nodeDetails.ts`, `NodeDetails/index.tsx` | Σ rows ❌ |
| Owner node | `dump.owner` (`src/data/sea-live/join.ts`) | Server ✅ |
| Tổng phe (tab Phe) | `selectors/board/factionBoard.ts` | Σ guild `0x0025` — server ✅ |
| BXH cá nhân | `dump.playerBoard` | Board 117 — server ✅ |

Hệ quả: ở node bị cắt, tổng và % thấp hơn thật; phe có điểm nhưng không lọt
top-20 hiện 0; pill "Chưa chiếm" có thể báo sai vì so ngưỡng với tổng đã bị cắt.

## 4. Số đo đối chiếu (crawl cụm 517, 2026-10-29 19:41)

So `faction_scores` với Σ board 118 cùng run, theo cặp (node, phe) có điểm:

- 71 cặp khớp, **44 cặp thiếu trên 26 node**, **0 cặp Σ rows > server**. Mọi cặp
  thiếu đều ở node đủ 20 row → khớp giả thuyết cắt top-20.
- Lệch nặng nhất: node 54 phe 4 thiếu 33.8% (34.18M vs 22.64M); node 64 phe 1
  thiếu 22.1%; node 48 phe 4 thiếu 21.5%.
- Phe có điểm nhưng 0 row: node 57 phe 3 (1.22M), node 54 phe 3 (65K), node 65
  phe 2 (11K).
- Σ `faction_scores` trên 89 node so với Σ guild `0x0025` từng phe: phe 1, 3, 4
  khớp từng điểm; phe 2 lệch 72K (0.008%, nghi do 2 request khác thời điểm).
  → Điểm node-state là phân bổ theo node của đúng điểm phe ở tab Phe.

Đo ở run 2026-10-30: 30/89 node thiếu, nặng nhất node 54 thiếu 20.6%.

## 5. Điểm còn mở

1. **Pool hay tổng tích lũy?** [Research 2026-10-24 §6.7](../research/2026-10-24-sea-capture.md)
   ghi f2 `0x0012` "fluctuate" (node 64 phe 3 từ 21.8M về 0, owner không đổi).
   Số đo §4 (không có Σ rows > server, khớp tổng guild) cho thấy là tổng tích lũy.
   Cần chốt: crawl 2 lần cách nhau, so từng (node, phe); nếu có cặp giảm thì xem
   có trùng lúc node đổi chủ / reset không.
2. **f5 `campScores`**: decode thêm vào `parse_node_state`, đối chiếu với f2.
3. **Hiển thị phần thiếu**: có hiện dòng "khác" = điểm phe − Σ rows ở node bị cắt
   không (đề xuất, chưa chốt).

## 6. Đề xuất triển khai

- `report.py`: dump key `nodeFactionScores: {gameNodeId: {campId: score}}` từ
  `node-states.jsonl`.
- FE: `scoresForNode` ưu tiên `nodeFactionScores`, fallback Σ rows khi dump cũ
  thiếu key; `reachedClaim`, tổng, % đều dùng số này. Board rows chỉ còn cho danh
  sách player.
- Docs cập nhật cùng lúc: [LEADERBOARD_SPECS.md §1.3](../LEADERBOARD_SPECS.md)
  (tab Cứ điểm hiện ghi "list + expand đều là board 118"),
  [SEA_STRUCTURE.md §3.2](SEA_STRUCTURE.md) (đoạn "mọi thống kê derive từ BXH
  player từng node"), [CONNECTION_UI_BACKLOG.md §2–3](../CONNECTION_UI_BACKLOG.md)
  (nguồn `entry.scores` / `reachedClaim`), [SEA_LIVE_DATA.md](SEA_LIVE_DATA.md)
  và docstring `report.py` (key dump mới).
