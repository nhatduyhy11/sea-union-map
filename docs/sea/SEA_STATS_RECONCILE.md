# SEA_STATS_RECONCILE — Nguồn điểm và cách sử dụng

> Nguồn sự thật cho câu hỏi "tổng điểm X lấy từ đâu" trên Web UI.
> Mô tả nguồn điểm, giới hạn dữ liệu, cách BE/FE sử dụng và các điểm còn mở.

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
| Tab Cứ điểm: pill "Chưa chiếm", tô màu row | `NodeBoard.tsx` | Owner server ✅ |
| NodeDetails: điểm phe, tổng, phe dẫn | `selectors/nodeDetails.ts`, `NodeDetails/index.tsx` | Node state ✅ |
| Owner node | `dump.owner` (`src/data/sea-live/join.ts`) | Server ✅ |
| Tổng phe, điểm guild (tab Phe) | `selectors/board/factionBoard.ts` | Σ guild `0x0025` ✅ |
| BXH cá nhân | `dump.playerBoard` | Board 117 ✅ |
| Danh sách player tại node, expand player, member guild | `attackersForNode`, `playerAllocations`, `buildGuild` | Board 118 — best-effort |

Phần best-effort: ở node bị cắt, Σ điểm player trong danh sách < điểm phe; player
không lọt top-20 của node nào thì không có dòng expand; điểm member guild là Σ
row của member đó.

## 4. Điểm còn mở

1. **Pool hay tổng tích lũy?** Chưa chốt ý nghĩa tích lũy của f2
   `campHurtScores`. Cần kiểm tra biến động theo thời gian và quan hệ với đổi chủ /
   reset node. UI vẫn dùng trực tiếp điểm server trả về.
2. **f5 `campScores`**: decode thêm vào `parse_node_state`, đối chiếu với f2.
3. **Hiển thị phần thiếu**: có hiện dòng "khác" = điểm phe − Σ rows ở node bị cắt
   không (đề xuất, chưa chốt).
