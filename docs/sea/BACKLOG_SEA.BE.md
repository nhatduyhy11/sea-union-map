# BACKLOG SEA — Kế hoạch & Các việc tồn đọng

> Việc ghi vào đây khi phát hiện hoặc chốt yêu cầu mới; mỗi mục ghi đủ context +
> hướng fix để người sau pick up không phải đào lại.

---

## I. Crawler & Backend Python

### 1. Cache Sea theo đợt event × cụm server; migrate data cũ, bỏ fallback format cũ

**Đã triển khai 2026-11-18**: migration one-off (72 dump → 26 bộ cache),
crawler tự tạo/dùng lại cache, FE chỉ đọc format mới. Đợt mặc định theo lịch
`EVENT_ROUNDS`, có `--event-start` override; chưa tự suy ngày thi đấu từ
`GetOutInfoR.startDt` (mục 2). `--rebuild-info-cache` thay tool backfill cũ.
Validation: giữ nguyên dữ liệu biến động/boss; builder từ raw capture cụm 517
qua cùng schema và giữ các giá trị đã có trong cache migration; test lifecycle tạo lần đầu/dùng lại và report
không cần file brief trong run. Live smoke bằng profile có sẵn timeout login
180 giây trước khi tới crawl; chưa xác nhận crawl live với phiên đăng nhập hợp lệ.

Chốt scope 2026-11-18: **chỉ Sea**. Mine có cache và rule riêng, xử lý sau;
không dùng chung cache Sea/Mine và không áp rule roster Sea cho Mine.

- **Rule game do người dùng cung cấp**: event đã start thì member rời bang mất
  quyền thi đấu; member vào sau không được contribute. Chụp roster/info một lần
  trong đợt; user không có brief trong cache được chấp nhận, không tự hỏi thêm.
  Cache phục vụ ghép danh tính; điểm/BXH vẫn là dữ liệu server, không tự loại
  row hoặc suy quyền thi đấu từ roster cache.
- **Hiện trạng đã review**:
  - `sea_socket/crawl/phases.py` hỏi brief mọi guild mỗi run; player brief chỉ
    fetch cho ID trên BXH, có retry/backoff (`crawl/briefs.py`).
  - Snapshot map đã có roster đầy đủ player → guild; không cần gọi roster
    riêng từng guild để biết danh sách cần fetch ở lần build cache.
  - Boss đã tách ở `src/data/node-bosses/<event-start>/<server>.json`.
  - Đã có 66 snapshot: đợt `261026` có 53 file/13 cụm, đợt `261116` có
    13 file/13 cụm; mỗi đợt có đủ 13 file boss tương ứng.
  - Snapshot không có brief toàn bộ roster: ví dụ `261116/517.json` có 2.830
    member trong roster nhưng chỉ 290 brief. Migration giữ info có thật,
    không bịa brief cho member thiếu; thiếu tên/power vẫn hiện `#id`/`—`.

- **Cấu trúc đích** (gom boss và info Sea vào cùng root):

  ```text
  src/data/event-cache/<event-start>/<server>/
    bosses.json
    info.json
  ```

  `info.json` có schema version, eventStart, server, thời điểm nguồn và các map
  `guildRoster`, `guildNames`, `guildPower`, `briefs` (giữ kiểu field FE đang
  dùng). Namespace cache dùng cụm thực tế, không mặc định 517.
  Power/tên là giá trị lúc chụp cache, không còn cam kết cập nhật mỗi ngày.

- **Migration one-off cho data hiện có khi chuyển format**:
  - Script chuyển đổi chỉ dùng lúc triển khai này; không phải bước setup hay
    workflow bắt buộc cho các đợt sau. Các đợt/cụm mới do crawl đầu tự tạo cache.
  - Group snapshot theo đợt × cụm bằng lịch event, không lấy ngày snapshot
    làm eventStart. Bao gồm dump bundled `sea-live.json`, các dump lịch sử
    `sea-live.*.json` còn được giữ và dev dump nếu có dùng; xác định cụm/đợt
    rõ ràng, không đoán cụm từ brief của một player.
  - Trong mỗi group: dùng snapshot sớm nhất làm baseline; snapshot sau chỉ
    lấp ID/field chưa có. Giá trị đã có giữ nguyên; log xung đột tên/power/
    guildId để review. Không ghép info giữa hai đợt hoặc hai cụm.
  - Guild membership trong info dùng roster event làm nguồn chuẩn, tránh
    brief guildId hiện tại làm lệch việc ghép guild (data cũ có trường hợp lệch).
  - Chuyển boss sang root mới; tách các map info khỏi snapshot/dump, cập nhật
    toàn bộ loader, kiểu dữ liệu và consumer trong cùng lần chuyển format.
  - Dry-run trước; validate toàn bộ output trước khi bỏ field/file cũ, chạy
    lại phải cho cùng kết quả. Sau migration không duy trì nhánh fallback đọc
    info embedded hay đường dẫn boss cũ.

- **Builder/crawler sau migration**:
  - Dùng chung hàm chuẩn hóa + validator schema cho migration và builder từ
    raw crawl để tránh hai bên sinh hai format khác nhau.
  - Mỗi lần crawl xác định đợt/cụm rồi kiểm tra cache: chưa có thì tự build
    ngay trong lần crawl đầu (không cần chạy builder/setup riêng), có rồi thì
    dùng lại. Lần đầu lấy roster từ snapshot map, guild brief và player brief
    cho toàn bộ roster; đồng thời tạo cache boss từ node state.
  - Brief không trả về vẫn được phép thiếu; cache đã build không tự fetch lại
    những ID đó trong các lượt crawl sau. Chỉ đánh dấu cache hoàn tất sau khi
    ghi/validate thành công; cache hỏng hoặc lần tạo bị gián đoạn không được
    coi là cache hợp lệ chỉ vì file đã tồn tại.
  - Crawl thường chỉ lấy dữ liệu biến động (node state, owner, BXH, điểm guild,
    fuel…), bỏ các phase inject guild/player brief; FE ghép info từ event cache.
  - Thiếu cả cache cho đợt/cụm kích hoạt tạo cache trong crawl đầu. FE chỉ đọc
    format mới; data xuất bản phải đi kèm cache hợp lệ. Thiếu user trong cache
    là hợp lệ, vẫn giữ row/điểm server.
  - Rebuild cache phải là thao tác chủ động; không tự refresh do cache miss.

- **Validation khi triển khai**:
  - Migrate toàn bộ data đã lưu rồi kiểm tra mỗi snapshot có cache đúng đợt/cụm,
    boss/roster/điểm không mất, và không còn info embedded cần fallback.
  - Chỉ chạy thử crawler cho **một cụm (517)** ở output tạm chưa có cache để
    kiểm tra tự tạo cache trong lượt đầu, không đụng cache đã migrate. Output
    phải qua cùng validator, có cùng schema/key type với cache migration;
    không yêu cầu tên/power mới fetch bằng giá trị lịch sử.
  - Chạy crawl thường cụm đó với cache có sẵn, xác nhận không inject request
    guild/player brief và FE vẫn đọc được snapshot sau cleanup. Kiểm tra cả
    trường hợp player thiếu brief. Không cần crawl lại mọi cụm để migration.

### 1b. Guild brief trả rỗng với guild inactive — chỉ xử lý lúc build cache

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
- **Hướng làm** (cập nhật 2026-11-18: chỉ áp dụng builder/rebuild cache ở mục 1;
  crawl thường không hỏi brief và không retry cache miss):
  - Builder: guild nào response rỗng (`name` null) thì đưa vào hàng retry
    cuối phase, backoff tăng dần (cùng kiểu `RETRY_BACKOFF` của backfill), vài
    vòng; vẫn rỗng thì log id + giữ fallback FE (cộng power brief member).
  - Kiểm chứng giả thuyết: thử hỏi lại `5270018` vài lần cách nhau (ngay /
    vài phút / vài giờ); thử brief player 4 member để xem có cùng bị rỗng
    không (inactive cả account hay chỉ guild).
  - Tool backfill cũ phải được điều chỉnh theo writer cache mới trước khi dùng;
    không re-dump info embedded sau migration.

### 1c. Re-dump đọc identity từ metadata — đã xử lý cùng mục 1

Crawler ghi `server` và `event_start` vào `meta.json`. Report bắt buộc đọc hai
key này, không mặc định cụm 517; `--server` truyền tay phải khớp metadata.

### 2. Boss node — tự nhận diện đợt và catalog

- **Tự nhận diện đợt event**: crawler hiện đọc lịch `EVENT_ROUNDS` của FE
  (hoặc `--event-start`), không còn hard-code ngày trong report. Nghiên cứu dùng
  `GetOutInfoR.startDt` để suy ngày đầu thi đấu; startDt có thể là đầu phase
  đăng ký, không được dùng trực tiếp làm namespace cache nếu chưa đối chiếu.
- **Danh mục chung theo phiên bản config**: tích hợp `seaMonstersById[monsterId]`
  cho config Sea (tên, mô tả, hero gợi ý), `creepsByCode[code]` cho unit; skill
  lookup tách riêng nếu cần. Đã có tool extract config/assets và render ảnh tại
  `tools/socket_log/sea_socket/per_event/boss_extract.py`, `boss_render.py`;
  FE hiện chỉ có bảng tên và ảnh trong `src/data/nodeBosses.ts`.

Nguồn và chuỗi ID: [SEA_STRUCTURE.md §4.2](SEA_STRUCTURE.md#42-boss-node-campgvgmonsterlo).

---

## Nhánh phụ: Khai Thác Guild (Mine)

Các việc tồn đọng thuộc nhánh Khai Thác Guild (module `0x48`, logger, report, streak/debuff) có mức ưu tiên thấp hơn và được quản lý riêng tại:
👉 [`docs/mine_docs/BACKLOG_MINE.md`](../mine_docs/BACKLOG_MINE.md).
