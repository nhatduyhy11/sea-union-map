# Crawl bằng fresh auth

Trạng thái (2026-11-02): mode fresh-auth đã tích hợp vào SEA crawler, login với
token thật hoạt động.

## Vì sao

Profile persistent tốn dung lượng khi crawl nhiều acc/server. Đo 6 profile
ngày 2026-11-01: `Default/Cache` + `Default/Code Cache` khoảng 3,67 GiB, hơn 97%
tổng dung lượng. Crawler vẫn phải tải runtime game (socket, module đọc server,
decode leaderboard), nên không thao tác UI không có nghĩa là không cần asset.

Vận hành: người dùng tự chọn server, mỗi lượt một terminal, có thể chạy song
song vài lượt. Chưa cần scheduler hay tự tăng concurrency.

## Mode fresh-auth

```bash
uv run python tools/socket_log/sea_socket/crawler.py \
  --auth-json /path/to/auth.json --acc 'account@example.com' \
  --dump-out src/data/snapshots/261031/
```

- [browser/auth.py](../../tools/socket_log/browser/auth.py) đọc JSON, thay
  `userLoginData.value` bằng object của email trong `allLoginList.value`, giữ các
  key khác, restore localStorage tại origin SDK. File JSON chỉ đọc, token không
  ghi vào meta.
- [browser/session.py](../../tools/socket_log/browser/session.py) mở browser +
  context non-persistent riêng cho mỗi terminal; không lock, không tạo profile.
- `--auth-json`/`--acc` đi cùng nhau và loại trừ `--profile`. Không truyền thì
  crawler dùng persistent profile như cũ.
- Timeout navigation fresh 60 giây mỗi attempt; timeout login cố định 180 giây.
- `--out` phải là thư mục mới; `--dump-out` cùng server thì lần ghi sau thay file.

Test (Chrome + trang SDK/game và socket giả, không gọi game thật):

```bash
uv run python -m unittest discover -s tools/socket_log/tests -v
```

## Điểm còn mở

- Chưa đo crawl đầy đủ bằng token thật: thời gian login/snapshot/hoàn tất, byte
  HTTP nhận, RAM khi chạy nhiều terminal. Context fresh tải lại toàn bộ asset mỗi
  lượt — đây là chi phí cần đo trước khi tối ưu.
- Token trong JSON có thể hết hạn; không refresh hay ghi ngược.
- Xác minh username trong SDK frame là kiểm tra phía client, chưa phải danh tính
  nhân vật do server xác nhận.
- Kill cưỡng bức/crash có thể để lại file tạm của browser.

## Hướng khác: cache asset dùng chung (chưa làm)

Ý tưởng: gắn `context.route` vào context fresh, phục vụ asset tĩnh từ một thư
mục cache chung thay vì tải lại từ CDN mỗi lượt.

Chưa làm vì chưa có số đo cho thấy việc tải lại asset là vấn đề. Rủi ro chính
không nằm ở code mà ở việc trả nhầm asset cũ/sai header khiến game lỗi theo cách
khó debug, cộng thêm overhead khi mọi request đi qua Python. Chỉ cân nhắc khi
baseline cho thấy băng thông hoặc thời gian khởi động thật sự cản việc crawl.

Đã loại: symlink/chung `--disk-cache-dir` (Chromium không phối hợp cache giữa
nhiều process), proxy HTTPS ngoài browser (cần MITM TLS).

## Nguồn

- [Playwright: persistent context](https://playwright.dev/python/docs/api/class-browsertype#browser-type-launch-persistent-context)
- [Playwright: routing, HTTP cache và service workers](https://playwright.dev/python/docs/api/class-browsercontext#browser-context-route)
- [Playwright: route.fetch / route.fulfill](https://playwright.dev/python/docs/api/class-route)
- [Chromium: disk cache](https://www.chromium.org/developers/design-documents/network-stack/disk-cache/)
