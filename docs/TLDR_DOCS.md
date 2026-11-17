# TLDR — lệnh hay xài

Cheat sheet **cho người** (human-first, quick action): chỉ ghi các lệnh chủ dự án hay dùng
nhất, copy-paste là chạy. Không phải tài liệu đầy đủ — chi tiết flag và luồng dữ liệu xem
[README.BE.md](../README.BE.md) (crawler) và [README.md](../README.md) (Web UI).

Khi được hỏi "chạy X bằng lệnh gì", tra file này **trước**, không đủ mới xuống README.

## Frontend (pnpm)

```sh
pnpm install              # cài deps
pnpm run dev              # dev server http://127.0.0.1:5173 (ưu tiên public/sea-live-dev.json nếu có)
pnpm run typecheck        # tsc --noEmit
pnpm run build            # typecheck + build static ra dist/
pnpm run build:analyze    # build + bundle visualizer
pnpm run format           # prettier --write .
pnpm run format:check     # prettier --check .
pnpm run loc              # thống kê LOC file > 100 dòng → scripts/loc-report.md (node scripts/loc.mjs [min])
```

Trước khi commit: `pnpm run typecheck && pnpm run format:check`.

## Deploy FE (branch `deploy-fe`)

```sh
pnpm run cleanup          # chỉ chạy trên deploy-fe: xoá phần BE/docs (tools, docs, CLAUDE.md, pyproject…),
                          # xoá scripts/, rồi git reset --soft HEAD~1 để gộp vào commit deploy trước
```

Script `scripts/cleanup-deploy-branch.sh` chỉ có trên `deploy-fe`; branch khác sẽ báo lỗi và thoát.

## Crawl sea (Tranh Bá Tứ Hải)

Tất cả chạy qua `uv run python ...` từ root repo. Cần session đăng nhập: `--profile .tmp/<name>`
**hoặc** `--auth-json PATH --acc EMAIL` (không dùng chung hai cách).

```sh
# Crawl 89 node + dump → public/sea-live-dev.json (refresh browser là thấy)
uv run python tools/socket_log/sea_socket/crawler.py --profile .tmp/p545

# Crawl thẳng vào snapshot theo ngày, tự đặt tên <server>.json
uv run python tools/socket_log/sea_socket/crawler.py \
  --dump-out src/data/snapshots/<YYMMDD>/ --profile .tmp/pjen

# Fresh auth từ JSON localStorage SDK (không cần profile)
uv run python tools/socket_log/sea_socket/crawler.py \
  --dump-out src/data/snapshots/<YYMMDD>/ --auth-json /path/to/auth.json --acc 'email@example.com'

# Chỉ lấy raw run, không dump
uv run python tools/socket_log/sea_socket/crawler.py --profile .tmp/p545 --no-dump
```

### Crawl mọi acc trong auth JSON (full server)

```sh
uv run python scripts/fullcrawl.py /path/to/auth.json --dry-run          # list acc + validate, chưa chạy
uv run python scripts/fullcrawl.py /path/to/auth.json                    # crawl tuần tự, dump vào src/data/snapshots/<event-day>/
uv run python scripts/fullcrawl.py /path/to/auth.json --headless --timeout-min 10
uv run python scripts/fullcrawl.py /path/to/auth.json --only 'a@x.com,b@x.com'
uv run python scripts/fullcrawl.py /path/to/auth.json --fail-fast        # dừng cả loạt khi 1 acc FAIL
```

Log mỗi lần chạy: `.tmp/fullcrawl.<yymmdd_HHMMSS>.log`.

## Crawl mine (Khai Thác Guild)

```sh
uv run python tools/socket_log/mine_socket/logger.py --profile .tmp/p545 --snapshot       # 1 pass rồi thoát
uv run python tools/socket_log/mine_socket/logger.py --profile .tmp/p545 --duration 300   # log 5 phút
uv run python tools/socket_log/mine_socket/report.py                                      # báo cáo từ .tmp/mine-events
uv run python tools/socket_log/mine_socket/decode.py .tmp/socket-capture/<run> mine-events
```

## Tiện ích BE

```sh
# Test Python (synthetic, không cần login)
uv run python -m unittest discover -s tools/socket_log/tests -v

# Lint Python
uv run ruff check tools scripts

# Kiểm tra drift config CampGVG (headless, không cần login)
uv run python tools/socket_log/config_extract.py --table CampGVGLO --out .tmp/sea-crawl/campgvglo.json

# Decode 1 body runtime codec
uv run python tools/socket_log/core/runtime_codec.py rank body.b64
```

## Đường dẫn hay gặp

| Đường dẫn                                   | Ý nghĩa                                                |
| ------------------------------------------- | ------------------------------------------------------ |
| `.tmp/sea-crawl/<run>/`                     | Raw output mỗi lần crawl (gitignored)                  |
| `public/sea-live-dev.json`                  | Dump dev, FE dev server fetch lúc runtime (gitignored) |
| `src/data/sea-live.json`                    | Bản baked vào build (committed)                        |
| `src/data/snapshots/<YYMMDD>/<server>.json` | Snapshot lịch sử theo ngày × cụm (committed)           |
| `.tmp/<profile>`                            | Persistent profile Playwright có session login         |
