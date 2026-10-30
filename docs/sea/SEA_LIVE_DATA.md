# Dữ liệu sea-live: dump vs baked, dev vs build

Tài liệu này là nơi chính giải thích các file JSON crawl sea, chúng được dùng ở
đâu lúc dev và lúc build/deploy. README có sơ đồ tổng quát ở mục
[Luồng crawl → UI](../../README.BE.md#luồng-crawl--ui); tài liệu này đi sâu chi tiết.

## Thuật ngữ

Pipeline chuẩn hóa 4 bước (chi tiết ở [`README.BE.md`](../../README.BE.md), mục
"Mode 1 — sea"): **crawl → extract → transform → dump**.

- **Dump** — file JSON **ghi ra disk** sau mỗi lần crawl
  (`tools/socket_log/sea_socket/report.py`, hoặc `crawler.py --dump` gọi cùng
  hàm `dump_run`): "dump" là hành động ghi kết quả crawl ra file, và
  cũng chỉ file kết quả đó. Là snapshot dữ liệu server tại thời điểm
  `snapshotAt`, chưa "chốt". Data trong memory của crawler (JSONL thô ở
  `.tmp/sea-crawl/`) không phải dump.
- **Baked** — bản dump đã được **commit vào `src/data/sea-live.json`** và được
  Vite import tĩnh (`import raw from "./sea-live.json"` trong
  `src/data/sea-live.ts`), nên bị **nhét thẳng vào bundle lúc build**. Bản deploy
  chỉ có bản baked — không fetch gì từ server ngoài.

## Các file JSON

| File | Git | Ai ghi | Ai đọc | Vai trò |
| --- | --- | --- | --- | --- |
| `src/data/sea-live.json` | **committed** | `report.py --out src/data/sea-live.json` (chủ động, re-dump run cũ) | import tĩnh trong `src/data/sea-live.ts` | Bản chính thức, **baked vào build** |
| `public/sea-live-dev.json` | **gitignored** | `crawler.py --dump` (mặc định bật, mỗi lần crawl) hoặc `report.py` default | `fetch` lúc dev server chạy | Dump "xem trước", refresh browser là thấy |
| `dist/sea-live-dev.json` | gitignored (cả `dist/`) | Vite copy nguyên thư mục `public/` lúc build | không ai đọc | Được ship lên Pages nhưng **chết** — code build không fetch. Vô hại, có thể bỏ bằng cách xoá file trong `public/` trước khi build |
| `src/data/sea-live.261027-*.json` | committed | copy tay | **không có code nào import** | Snapshot thủ công theo thời điểm, chỉ để lưu lịch sử |
| `src/data/snapshots/<YYMMDD>/<server>.json` | committed | `report.py --snapshot [--server N]` | `import.meta.glob` lazy trong `src/data/snapshots.ts` | Snapshot lịch sử theo ngày event × cụm — thanh ngày dưới canvas + server switcher |

`src/data/sea-live.json` là bản live (ngày hiện tại, cụm 517) import tĩnh; snapshot lịch sử import lazy (mục dưới). Chunk `sea-data` (tách trong `vite.config.ts`
qua `manualChunks`) chính là bản baked này.

## Dev local dùng cái nào?

Chọn tại `src/data/sea-live.ts` bằng `import.meta.env.DEV` (top-level await):

```
vite dev
 └─ DEV = true
     └─ fetch /sea-live-dev.json  (từ thư mục public/)
         ├─ có file, parse OK → dùng dev dump (log "[sea-live] dùng dev dump (snapshot …)")
         └─ 404 / sai format / fetch lỗi → fallback bản baked (sea-live.json)
```

- **Cách kiểm đang dùng bản nào:** mở DevTools console — có dòng
  `[sea-live] dùng dev dump (snapshot …)` là dump mới crawl; không có là baked.
- **`vite test` / `tsx --test`:** ngoài Vite `import.meta.env` không tồn tại —
  guard `?.` khiến unit test luôn chạy trên bản baked (committed).
- **`vite preview`:** chạy bản build → như build, dùng baked.

## Build / deploy dùng cái nào?

```
vite build
 └─ DEV = false → dùng baked, KHÔNG fetch
     └─ sea-live.json nằm trong chunk dist/assets/sea-data-*.js
         └─ GitHub Pages serve static → người xem chỉ thấy bản này
```

Deploy **không bao giờ** đọc `public/sea-live-dev.json` dù file có bị copy sang
`dist/`. Nghịch lại: cập nhật dump dev ở local không đổi được bản deploy.

## Luồng cập nhật data

```
crawl → crawler.py (--dump mặc định bật) → public/sea-live-dev.json  # xem trước ở dev
chốt → report.py --crawl <run> --out src/data/sea-live.json         # bake bản chính thức
     → git commit → vite build → chunk sea-data → deploy            # bản deploy dùng bản này
```

Cập nhật data trên bản deploy = 3 bước cuối; refresh browser không đủ (khác
dev).

## Snapshot lịch sử theo ngày × cụm

Layout: `src/data/snapshots/<YYMMDD>/<server>.json` (vd `261028/590.json`),
cùng format dump. `src/data/snapshots.ts` quét bằng `import.meta.glob` — thêm
file là UI tự thấy (không manifest), mỗi file là một chunk lazy, chỉ tải khi
người dùng chọn ngày/cụm đó.

```
uv run python tools/socket_log/sea_socket/report.py --crawl <run> --snapshot [--server 590]
```

- **Quy ngày theo thời điểm chạy script (giờ VN):** trong khung chiến trường
  10:00~22:00 → ngày hôm đó; từ 22:00 tới trước 10:00 hôm sau → ngày trước.
  Tương đương ngày lịch của (t − 10h). Rule nằm ở `report.py::event_day` và
  `src/data/eventCalendar.ts::eventDayOf` — sửa thì sửa cả hai.
- **`--server` mặc định 517 — TẠM THỜI:** crawler chưa ghi cụm vào run; dump
  cụm khác thì truyền `--server` hoặc đổi tên file tay sau khi dump.
- **UI:** server switcher cạnh tiêu đề "Tranh bá Tứ Hải" (danh sách cụm lấy từ
  snapshot); thanh 7 ngày event dưới legend 4 phe. Ngày hiện tại + cụm 517 =
  live (`sea-live.json`); cụm khác ở ngày hiện tại chưa hỗ trợ → fallback
  snapshot gần nhất của cụm đó. Ngày đã qua thiếu snapshot: nút flat, hover
  "Lịch sử lưu bị thiếu", click → toast lỗi. Ngày chưa tới: nút xám, disable.
- Event 2026 thiếu snapshot 26 + 27 (không kịp chụp); `sea-live.261027-*.json`
  ở trên chưa đưa vào thư mục snapshot.
