# STATS_MISMATCH — số liệu UI lệch so với game (backlog handoff)

> Trạng thái chốt 2026-10-26: UI (`src/data/sea-live.json`) tổng điểm từ **node-board
> rows** (đúng semantic hiện có của `src/domain/selectors.ts`), chấp nhận lệch với
> số server ở những chỗ ghi dưới đây. Đây là note bàn giao: ai pick up việc "khớp
> số 100%" bắt đầu từ đây, không cần đào lại capture.

## Luồng dữ liệu hiện tại

Chi tiết luồng + ranh giới vai trò Python (dump JSON) / FE (adapter join):
[`README.md`](../README.md) (mục "Luồng crawl → UI").

```
sea_socket/crawler.py → .tmp/sea-crawl/<run>/  (JSONL + boards-decoded.json)
config_extract.py → campgvglo.json  (config client CampGVG, 89 row)
sea_socket/report.py → src/data/sea-live.json   (thuần data, không sinh code)
src/data/sea-live.ts                    (adapter join layout qua prefix display id)
src/domain/mapData.ts (LIVE = true)     (derive owner/BXH/filter từ contributions)
```

Regenerate sau mỗi lần crawl mới (mặc định dump vào `public/sea-live-dev.json`
— gitignored, FE dev fetch lúc runtime; thêm `--out src/data/sea-live.json`
để bake snapshot chính thức vào build):

```bash
uv run python tools/socket_log/config_extract.py --table CampGVGLO --out .tmp/sea-crawl/campgvglo.json
uv run python tools/socket_log/sea_socket/report.py --crawl .tmp/sea-crawl/<run> --config .tmp/sea-crawl/campgvglo.json
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
> mới derive từ node boards. Contract mới: [`LEADERBOARD_SPECS.md`](LEADERBOARD_SPECS.md)
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

### 5.1. Brief player bị thiếu — cooldown server, đã xử lý hết (chốt 2026-10-27)

Crawler cũ gom id brief không retry, server nuốt 1 batch 60 id (seq=169 trả 0
brief) → 55 player mất tên. Quá trình xử lý và bài học:

- **Throttle:** tool `brief_backfill.py` re-request ids thiếu (chunk 20 +
  backoff, chỉ stage login). Lần 1: 39/59, `players.jsonl` 257 → 307.
- **"Từ chối" thực chất là cooldown:** 16 id (toàn S513/S514) trả rỗng xuyên
  5 round, kể cả session mới → tưởng chặn cứng chéo server. ~90 phút sau,
  **1 batch 16 id riêng trả đủ 6.5KB brief** (`still missing: 0`,
  `players.jsonl` → 323). Bài học: batch rỗng ≠ bị cấm; re-run
  `brief_backfill.py` sau một khoảng thời gian là đủ.
- **4 pseudo-id `1..4`** (`id_type=5`, board 116) — không phải player, là 4
  dòng phe. Crawler + backfill đã skip `id_type != 1` khi gom.

Hai phát hiện đi kèm (cùng session 2026-10-27):

- **Roster player→guild nằm sẵn trong map snapshot** `0x72/0x000c` f4×N
  `{f1: guild id, f2×N {f1: player id}}` — 115 guild / 3020 player, độc lập
  với brief. `parse_map_snapshot` cũ parse f4 bằng `read_packed_varints`
  (mis-parse, vứt roster). Giờ dump `guildRoster` → player bị refuse brief
  vẫn đúng guild (report.py `guildRoster`, FE fallback `guildId`).
  51476884 (hạng 2 toàn server, VP phe2) thuộc **OLYMPUS `5140005`** cùng 14
  refused khác; 51305171 thuộc OneKing `5130004` (phe3).
- **Tên guild không cần member brief**: `0x24/0x0035 {f1: guild id}` →
  `0x0036` trả tên + members + description (115/115 guild, 103 tên thực —
  phần còn lại là guild giải tán/rỗng trả err). Crawler thu `guild-names.json`
  mỗi run; report.py merge vào `guildNames`.

- **Boss node = null**: tên/trait boss nằm ở config khác (`SkillBuffBossLO`,
  NEED_CONFIRM 4 trong `SEA_PACKET_ANALYSE.md`) — chưa map. Level node đang
  theo tier demo (35/60/100), không phải số game.
- **"Hiệu suất sản xuất 12/24/36/h"** không nằm trong CampGVG (NEED_CONFIRM 3).
- **`_monsterType`** ([[1,60,1],…]) nghi là nhóm quái theo mốc power — chưa decode.

## Evidence

- Run chuẩn: `.tmp/sea-crawl/sea-crawl-v4/` (89/89 state, 89 board, 243 brief).
- CampGVG dump: `.tmp/sea-crawl/campgvglo.json` (89 row; base 1=east, 2=south,
  3=north, 4=west — đối chiếu specs/map-{right,mid,base}.PNG).
- Join đã verify: game 63 → "1-11Đảo Lều Trại" (khớp GUI shot header,
  `SEA_PACKET_ANALYSE.md` §1.2); UI node 1-23 = game 8: 2.307.224 tổng,
  VNChiến 850.529 top-1 — khớp run GUI 14:29 từng chữ.
- Shot UI chạy live data: `docs/assets/sea-socket/sea-live-map.png`,
  `sea-live-node-detail.png` (2026-10-26).
