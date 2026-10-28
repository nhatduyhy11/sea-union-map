# Dữ liệu sea-live: dump vs baked, dev vs build

Tài liệu này là nơi chính giải thích các file JSON crawl sea, chúng được dùng ở
đâu lúc dev và lúc build/deploy. README có sơ đồ tổng quát ở mục
[Luồng crawl → UI](../../README.md#luồng-crawl--ui); tài liệu này đi sâu chi tiết.

## Thuật ngữ

- **Dump** — file JSON **ghi ra disk** sau mỗi lần crawl
  (`tools/socket_log/sea_socket/report.py`): "dump" là hành động ghi kết quả crawl ra file, và
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
| `src/data/sea-live.json` | **committed** | `tools/socket_log/sea_socket/report.py --out src/data/sea-live.json` (chủ động) | import tĩnh trong `src/data/sea-live.ts` | Bản chính thức, **baked vào build** |
| `public/sea-live-dev.json` | **gitignored** | `tools/socket_log/sea_socket/report.py` (default, mỗi lần crawl) | `fetch` lúc dev server chạy | Dump "xem trước", refresh browser là thấy |
| `dist/sea-live-dev.json` | gitignored (cả `dist/`) | Vite copy nguyên thư mục `public/` lúc build | không ai đọc | Được ship lên Pages nhưng **chết** — code build không fetch. Vô hại, có thể bỏ bằng cách xoá file trong `public/` trước khi build |
| `src/data/sea-live.261027-*.json` | committed | copy tay | **không có code nào import** | Snapshot thủ công theo thời điểm, chỉ để lưu lịch sử |

Chỉ `src/data/sea-live.json` được import. Chunk `sea-data` (tách trong `vite.config.ts`
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
crawl → report.py (default)      → public/sea-live-dev.json   # xem trước ở dev
chốt → report.py --out src/data/sea-live.json                # bake bản chính thức
     → git commit → vite build → chunk sea-data → deploy     # bản deploy dùng bản này
```

Cập nhật data trên bản deploy = 3 bước cuối; refresh browser không đủ (khác
dev). Các lệch số đã biết giữa bản baked và UI game xem
[STATS_MISMATCH.md](STATS_MISMATCH.md).
