# BACKLOG SEA — Kế hoạch & Các việc tồn đọng

> Việc ghi vào đây khi phát hiện hoặc chốt yêu cầu mới; mỗi mục ghi đủ context +
> hướng fix để người sau pick up không phải đào lại.
>

---

## I. Crawler & Backend Python

### 1. Cache brief guild + player dùng chung cho pipeline mine & sea (default cụm 517)

Ý tưởng chốt 2026-10-28 — giảm thời gian fetch nói chung của cả hai nhánh:
brief player/guild hiện bị hỏi lại ở mỗi run dù id đã từng gặp.

- **Hiện trạng**:
  - Player brief: fetch theo lô 60 id qua inject `0x0d/0x001f` → `0x0d/0x0020`
    — sea dùng ở `tools/socket_log/sea_socket/crawl/briefs.py` (crawler +
    `brief_backfill.py` dùng chung); mine dùng `NameService`
    (`tools/socket_log/core/names.py`).
  - Guild brief: `0x24/0x0035 → 0x0036` (`GUILD_BRIEF_CMD`,
    `tools/socket_log/core/protocol.py`).
  - Brief chỉ sống trong output từng run (`players.jsonl`), không có nơi lưu
    chung → lần crawl sau hỏi lại từ đầu. Throttle risk: batch 60 id từng trả
    về rỗng, phải backfill bằng chunk 20 + pace 0.8s (evidence
    2026-10-27 trong `brief_backfill.py`).
- **Hướng làm**:
  - Persistent brief cache theo cụm server: **mặc định `517`**, nhận input
    khác qua CLI (vd `--server 590`) — 1 file/cụm, format `{id: brief}` cho
    cả player lẫn guild (vd `tools/socket_log/briefs/517.json`; tên/chỗ để
    chốt khi làm).
  - Flow chuẩn: load cache → lọc bỏ id đã có → chỉ fetch phần thiếu → merge
    bổ sung vào cache ngay khi có response. Gặp id nào chưa có trong cache
    thì tự động update bổ sung.
  - Option `--force-rebuild`: bỏ qua cache, hỏi lại toàn bộ rồi ghi đè (khi
    nghi stale — đổi tên guild, power drift, cache hỏng).
  - Module dùng chung đặt ở `tools/socket_log/core/` để cả `sea_socket/` lẫn
    `mine_socket/` import được.
- **Lưu ý**: cache phải tách theo cụm server (brief có field server, id có
  thể trùng giữa các cụm); khớp với hướng multi-server (guild identity dùng
  `guildId` từ game).

### 1b. Guild brief trả rỗng với guild inactive — crawler cần retry riêng

Ghi 2026-10-28.

- **Hiện trạng**: guild brief `0x24/0x0035 → 0x0036` giờ là nguồn lực chiến
  guild (`f3.f16`, parse trong `core/protocol.py` → dump key `guildPower`).
  Crawl 2026-10-28: 114/115 guild trả đủ; guild `5270018` (phe 4, điểm 0) trả `f3` rỗng
  → thiếu cả tên lẫn power, UI hiện `#5270018 [—]`.
  - Roster 4 member: `52709342`, `52719518`, `52749342`, `52799012` — không
    ai có brief, không ai lọt `nodeRows`/`playerBoard` (guild không hoạt động
    trong event).
  - Crawler (`sea_socket/crawl/briefs.py` `fetch_guild_briefs`) hỏi mỗi guild **1 lần,
    không retry** — response rỗng là mất luôn tới run sau.
- **Giả thuyết (chưa xác nhận)**: server xếp brief guild inactive vào hàng
  low-priority / cache lạnh → lần hỏi đầu trả rỗng, hỏi lại sau mới có. Khớp
  evidence cũ trong `brief_backfill.py`: 2026-10-27 16 guild rỗng lúc
  07:26 + 07:45, 12 guild còn thiếu trả đủ ngay chiều cùng ngày.
- **Hướng làm**:
  - Crawler: guild nào response rỗng (`name` null) thì đưa vào hàng retry
    cuối phase, backoff tăng dần (cùng kiểu `RETRY_BACKOFF` của backfill), vài
    vòng; vẫn rỗng thì log id + giữ fallback FE (cộng power brief member).
  - Kiểm chứng giả thuyết: thử hỏi lại `5270018` vài lần cách nhau (ngay /
    vài phút / vài giờ); thử brief player 4 member để xem có cùng bị rỗng
    không (inactive cả account hay chỉ guild).
  - Tạm thời lấp tay: `brief_backfill.py --run <run> --guilds` rồi re-dump.

### 1c. Crawler chưa ghi cụm server vào run

`report.py --snapshot` đang mặc định `--server 517`; crawl cụm khác phải chỉnh
tay cờ `--server`. Hướng làm: crawler ghi cụm vào metadata run → `report.py`
tự đọc, `--server` chỉ còn để override.

### 2. Lấy tổng điểm node từ `faction_scores` thay vì cộng board rows (key finding 2026-10-30)

Node state (`0x72/0x0012`) có sẵn **tổng điểm từng phe tại node**, là 4 con số do
server tính. Board 118 thì server cắt ở top-20/node
([SOCKET_PROTOCOL.md](SOCKET_PROTOCOL.md) §3.5), nên cộng row không ra tổng đúng.

- **Hiện trạng**: crawler đã lưu `faction_scores` (`node-states.jsonl`) nhưng
  `report.py` không dump; FE tính tổng node bằng sum(board rows). Đo 2026-10-30:
  30/89 node bị thiếu, nặng nhất node 54 thiếu 20.6%.
- **Hướng làm**:
  - `report.py`: dump thêm điểm phe per (node, phe).
  - FE: tổng điểm node (tab Cứ điểm, NodeDetail) và derive ownership lấy từ số
    này; board rows chỉ dùng cho chi tiết player.
  - Có thể hiện phần "khác" = điểm phe − Σ board rows ở node bị cắt, để người xem
    biết danh sách player không đủ.

---

## Nhánh phụ: Khai Thác Guild (Mine)

Các việc tồn đọng thuộc nhánh Khai Thác Guild (module `0x48`, logger, report, streak/debuff) có mức ưu tiên thấp hơn và được quản lý riêng tại:
👉 [`docs/mine_docs/BACKLOG_MINE.md`](../mine_docs/BACKLOG_MINE.md).
