# SEA_STATS_RECONCILE — Đối chiếu các nguồn "tổng điểm"

> Nguồn sự thật cho câu hỏi "tổng điểm X lấy từ đâu" trên Web UI. Ghi hiện trạng
> BE/FE, số đo đối chiếu và các điểm còn mở.

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
- `report.py` (`dump_run`) dump key `nodeFactionScores: {gameNodeId: {campId:
  score}}` từ `node-states.jsonl`. Run không có file thì bỏ key; node bị khoá
  hoặc parse rỗng thì bỏ node đó.

### FE

`join.ts` gắn số server vào `Island.factionScores` (key theo direction).
Mọi tổng node đi qua `scoresForNode` (`src/domain/selectors/nodeScores.ts`): có
`factionScores` thì dùng, không có (dump thiếu key / node thiếu state) thì cộng
`nodeRows` theo phe.

| Chỗ hiển thị | Code | Nguồn |
| --- | --- | --- |
| Popup điểm 4 phe trên canvas | `src/domain/mapData.ts` → `IslandNode/NodeStats.tsx` | Node state ✅ |
| Tab Cứ điểm: tổng, % phe dẫn, sort theo điểm | `selectors/board/nodeBoard.ts` | Node state ✅ |
| Tab Cứ điểm: pill "Chưa chiếm", tô màu row | `reachedClaim` / `topScore` trong `NodeBoard.tsx` | Node state so với `claimThreshold` ✅ |
| NodeDetails: điểm phe, tổng, phe dẫn | `selectors/nodeDetails.ts`, `NodeDetails/index.tsx` | Node state ✅ |
| Owner node | `dump.owner` (`src/data/sea-live/join.ts`) | Server ✅ |
| Tổng phe, điểm guild (tab Phe) | `selectors/board/factionBoard.ts` | Σ guild `0x0025` ✅ |
| BXH cá nhân | `dump.playerBoard` | Board 117 ✅ |
| Danh sách player tại node, expand player, member guild | `attackersForNode`, `playerAllocations`, `buildGuild` | Board 118 — best-effort |

Phần best-effort: ở node bị cắt, Σ điểm player trong danh sách < điểm phe; player
không lọt top-20 của node nào thì không có dòng expand; điểm member guild là Σ
row của member đó.

Snapshot đã commit không có `nodeFactionScores` (không còn run gốc để dump lại)
nên FE cộng `nodeRows` như trước; crawl mới dump đủ key.

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

Đo crawl cụm 590 2026-10-30 15:29: 68 cặp khớp, **61 cặp thiếu trên 35/89
node**, 0 cặp Σ rows > server, mọi node thiếu đều đủ 20 row. 7 cặp phe có điểm
mà 0 row, nặng nhất node 59 phe 2 (30.57M). Σ `faction_scores` khớp Σ guild
`0x0025` từng điểm ở cả 4 phe.

## 5. Điểm còn mở

1. **Pool hay tổng tích lũy?** [Research 2026-10-24 §6.7](../research/2026-10-24-sea-capture.md)
   ghi f2 `0x0012` "fluctuate" (node 64 phe 3 từ 21.8M về 0, owner không đổi).
   Số đo §4 (không có Σ rows > server, khớp tổng guild) cho thấy là tổng tích lũy.
   Cần chốt: crawl 2 lần cách nhau, so từng (node, phe); nếu có cặp giảm thì xem
   có trùng lúc node đổi chủ / reset không.
2. **f5 `campScores`**: decode thêm vào `parse_node_state`, đối chiếu với f2.
3. **Hiển thị phần thiếu**: có hiện dòng "khác" = điểm phe − Σ rows ở node bị cắt
   không (đề xuất, chưa chốt).
