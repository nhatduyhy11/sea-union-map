# DATA_PIPELINE — luồng crawl → UI

> Cập nhật 2026-10-26: đã chuyển sang **phương án B** — Python chỉ dump JSON thuần,
> join là adapter FE. Issue "format dump `.ts` generated có code client bên trong"
> không còn tồn tại; phần so sánh A/B giữ lại làm lý do quyết định.

## Luồng hiện tại

```
[1] sea_crawler.py        ──crawl WS game──▶  .tmp/sea-crawl/<run>/ (JSONL + boards-decoded.json)
[2] sea_config_extract.py ──boot game headless──▶ .tmp/sea-crawl/campgvglo.json (CampGVG 89 row)
[3] sea_to_ui.py          ◀── đọc [1] + [2] ──dump──▶ public/sea-live-dev.json (MẶC ĐỊNH — gitignored)
                                                     hoặc src/data/sea-live.json (--out, commit = bake vào build)
[4] src/data/sea-live.ts  (adapter FE, viết tay) + sea-live.test.ts
                          ◀── dev: fetch sea-live-dev.json, thiếu → fallback
                              build: import src/data/sea-live.json (baked)
                          ──export──▶ islands / contributions / routes
[5] FE: mapData.ts (LIVE switch) → derive owner/BXH/filter từ contributions
```

Hai file JSON, cùng schema:

- `public/sea-live-dev.json` — **gitignored**, dump mặc định của mỗi lần crawl.
  FE dev server fetch lúc runtime: crawl xong, refresh browser là thấy, không
  đụng git. Thiếu file hay sai format → rơi về bản baked.
- `src/data/sea-live.json` — **committed**, snapshot "chính thức" baked vào
  bundle lúc build. Chỉ cập nhật chủ động bằng `--out src/data/sea-live.json`.

Ranh giới vai trò:

- **Python** (`sea_to_ui.py`): chỉ gom crawl outputs thành một JSON — `camp`,
  `owner`, `nodeRows`, `briefs`, `baseDir`, `snapshotAt` — kèm cross-checks
  (base names, 4 owner base, node nào không map được layout) để bắt join hỏng
  trước khi data đến FE.
- **FE** (`src/data/sea-live.ts`): code client viết tay — `layoutIdOf` (prefix
  display id → layout id), `factionDir` (owner 4 base → hướng), join vào
  `layoutNodes` theo types `Contribution`/`Island`. Crawl (dev hay ship) không
  bao giờ đè file này; sửa join thoải mái, có unit test ở `sea-live.test.ts`.

## Vì sao chọn JSON tĩnh + adapter FE (so sánh với dump `.ts` generated)

| Tiêu chí | A. Dump `.ts` generated (cũ) | B. JSON tĩnh + adapter FE (hiện tại) |
| --- | --- | --- |
| Tách vai trò data/code | ❌ gộp một file generated | ✅ crawl đè chỉ đè JSON; adapter là code thường |
| Review diff lần crawl sau | ❌ data + code trộn nhau | ✅ diff chỉ có data |
| Unit test cho join | ❌ không tách được | ✅ `sea-live.test.ts` test trực tiếp hàm join |
| Sửa tay / tiến hoá logic join | ❌ bị đè lần crawl sau | ✅ sửa thoải mái, versioned |
| Runtime refresh khi war | ❌ phải rebuild (import tĩnh `.ts`) | ✅ fetch JSON mới, không rebuild |
| Type safety cho join | ✅ tsc check cùng lúc với data | ✅ ngang nhau (adapter khai báo interface, cast JSON) |
| Setup ban đầu | ✅ rẻ nhất — 1 file | thêm 1 lớp: `resolveJsonModule` + interface (đã có sẵn) |
| Vai trò Python | ⚠️ phải sinh đúng syntax TS | ✅ chỉ xuất JSON thuần — đúng vai trò meta-parser "nguồn" |

Ghi chú: về **bundle size / build-time bake** thì hai bên tương đương — cả JSON
import lẫn `.ts` literal đều được nhồi vào bundle lúc build. Khác biệt nằm ở
**sở hữu code** và **khả năng refresh runtime**, không ở performance.

## Refresh runtime

Phần dev đã xong (2026-10-26): dump dev là fetch lúc runtime — crawl mới không
cần rebuild. Còn lại, khi cần **auto-refresh trên bản deploy khi war**: thêm
poll `fetch` định kỳ cho dump chính thức (host `sea-live.json` tĩnh cạnh build)
và re-run adapter trên data mới. Adapter đã nhận data qua biến (không nhồi
literal) nên chỉ đổi chỗ lấy data ở `sea-live.ts`, join giữ nguyên.
