# STATS_MISMATCH — số liệu UI lệch so với game (backlog handoff)

> Trạng thái chốt 2026-10-26: UI (`src/data/sea-live.json`) tổng điểm từ **node-board
> rows** (đúng semantic hiện có của `src/domain/selectors/`), chấp nhận lệch với
> số server ở những chỗ ghi dưới đây. Đây là note bàn giao: ai pick up việc "khớp
> số 100%" bắt đầu từ đây, không cần đào lại capture.

## Luồng dữ liệu hiện tại

Chi tiết luồng + ranh giới vai trò Python (dump JSON) / FE (adapter join):
[`README.BE.md`](../../README.BE.md) (mục "Luồng crawl → UI").

```
tools/socket_log/sea_socket/crawler.py → .tmp/sea-crawl/<run>/  (JSONL + boards-decoded.json)
                                          └─ --dump (mặc định) → public/sea-live-dev.json
sea_socket/campgvg.json                  (cache BE config client CampGVG, 89 row — committed)
tools/socket_log/sea_socket/report.py    (transform + dump: thuần data, không sinh code)
src/data/sea-live.ts                     (adapter join layout qua prefix display id — buildLiveData)
src/domain/mapData.ts                    (buildMapData: derive owner/BXH/filter từ contributions)
```

Regenerate sau mỗi lần crawl mới (mặc định dump vào `public/sea-live-dev.json`
— gitignored, FE dev fetch lúc runtime; thêm `--out src/data/sea-live.json`
để bake snapshot chính thức vào build):

```bash
# 1 lệnh: crawl + transform + dump (config tự đọc từ baseline committed)
uv run python tools/socket_log/sea_socket/crawler.py --profile .tmp/pmain
# Re-dump run cũ khi cần:
uv run python tools/socket_log/sea_socket/report.py --crawl .tmp/sea-crawl/<run>
```

## 1. Tổng điểm node: sum(board) thiếu trên node nóng — server cắt top-20

Node board (`0x0c/0x0002 {f1:118}`) trả **tối đa 20 row/node**. Node có ≤20 người
đóng góp thì `sum(rows)` == pool "Điểm chiếm đóng" — ví dụ node 8: 2.307.224 vs
pool 2.307.379 (lệch 155 do pool mutate giữa 2 lần pull cách ~20s). Node đông hơn
thì thiếu: run v4 có **9/(node,faction) under-count, tập trung đúng 5 node chạm
mốc 20 row** (48/54/57/64/65), nặng nhất node 64 Phe 3: board 22.29M vs pool
22.99M (**-3.0%**).

- UI hiện tại: "Cứ điểm" + NodeDetail tính tổng từ sum(rows) → node nóng hiện thiếu.
- **Fix khi cần khớp 100%**: lấy pool per (node, faction) từ node-state
  `0x72/0x0011` f2 (field này **exact, không top-K**) làm tổng; board rows chỉ
  dùng cho chi tiết player. Cần mở rộng adapter + selectors nhận pool override.
- Chi tiết player hạng 21+ thì **không có nguồn nào** — chấp nhận mất tên, chỉ
  còn tổng (đúng ý "chấp nhận lệch" của chủ dự án).

## 2. BXH server chỉ trả top-K

| Board            | Server trả   | Ghi chú                                                        |
| ---------------- | ------------ | -------------------------------------------------------------- |
| BXH điểm (117)   | đúng 200 row | top-200 toàn server, không có phần còn lại                     |
| BXH phe (116)    | 4 row        | đủ tự nhiên (4 phe), `additionInfo` đủ guild/president/cityNum |
| Node board (118) | ≤20 row      | xem mục 1                                                      |

UI không dùng 116/117 làm nguồn sự thật — mọi BXH derive từ node-board rows
(`playersFromContributions`), nên hạng >200 toàn server và hạng >20 per node
không phản ánh rank game.

> **Hết hiệu lực 2026-10-27:** owner chốt lại — BXH Cá nhân dùng thẳng board
> 117, guild scores tab Phe dùng server board, chỉ member list (expand guild)
> mới derive từ node boards. Contract mới: [`LEADERBOARD_SPECS.md`](../LEADERBOARD_SPECS.md)
> §1.3.

## 3. Pool "Điểm ST" dao động — mọi con số là instant snapshot

Pool per (node, faction) trong `0x72/0x0012` **không lũy tiến**: node 64 Phe 3
tụt 21.8M → 0 giữa 2 run cách nhau vài phút mà không đổi chủ (pool đang tranh
đoạt). Ngược lại board per-player ổn định/tích lũy (node 8: VNChiến 850.529 giữ
nguyên từ 14:29 đến 16:49). So sánh 2 run cách xa nhau phải hiểu là 2 thời điểm,
không phải delta tích lũy.

## 4. Throttle server khi crawl — dữ liệu không thiếu nhưng phải retry

Server chặn burst inject với err `10000035` (set bị chặn đổi qua từng run, lô
~5 node). Crawler đã tự retry backoff (run v4: 6 lần dính, tất cả qua ở retry
đầu — 89/89 sạch). Run mới thấy `[throttle]` nhiều bất thường thì tăng
`REQUEST_PACE`, đừng bỏ qua.

## 5. Chỗ chưa có nguồn (không phải lệch, mà thiếu)

### 5.1. Brief player/guild — đã xử lý, pipeline crawl sạch (2026-10-27)

- **Batch poisoning:** batch brief chứa 4 pseudo-id `1..4` (`id_type=5`, 4 dòng phe
  của board 116) trả rỗng cả list → crawler + `brief_backfill.py` skip `id_type != 1`
  khi gom, retry có interval. Diễn biến điều tra:
  [`../research/2026-10-27-brief-missing.md`](../research/2026-10-27-brief-missing.md).
- **Roster player→guild nằm sẵn trong map snapshot** `0x72/0x000c` `guildInfos`
  (115 guild / ~3020 player), độc lập với brief → dump `guildRoster`; player bị từ
  chối brief vẫn đúng guild (FE fallback `guildId`).
- **Tên guild không cần member brief**: `0x24/0x0035 {guild id}` → `0x0036` trả tên +
  members + description. Response rỗng là trạng thái tạm (cold cache), retry muộn
  hơn trả đủ — `brief_backfill --guilds` merge, không ghi đè tên cũ bằng null.

### 5.2. Boss node trên UI

- **Chưa hiện boss**: nguồn thật đã tìm ra (`monsterId` → `CampGVGMonsterLO` —
  `SEA_PACKET_ANALYSE.md` §1.6) nhưng chưa đưa vào dump/UI (deliverable §3 cùng doc).

## Evidence

- Run chuẩn: `.tmp/sea-crawl/sea-crawl-v4/` (89/89 state, 89 board, 243 brief).
- CampGVG dump: `tools/socket_log/sea_socket/campgvg.json` (cache BE committed,
  89 row; base 1=east, 2=south, 3=north, 4=west — đối chiếu
  specs/map-{right,mid,base}.PNG).
- Join đã verify: game 63 → "1-11Đảo Lều Trại" (khớp GUI shot header,
  `SEA_PACKET_ANALYSE.md` §1.2); UI node 1-23 = game 8: 2.307.224 tổng,
  VNChiến 850.529 top-1 — khớp run GUI 14:29 từng chữ.
- Shot UI chạy live data: `docs/assets/sea-socket/sea-live-map.png`,
  `docs/assets/sea-socket/sea-live-node-detail.png` (2026-10-26).
