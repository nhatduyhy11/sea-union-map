# POC_authCrawl

Trạng thái: người dùng xác nhận POC login thành công với token thật; đã tích hợp
mode fresh-auth vào SEA crawler. Chưa xác minh crawl đầy đủ bằng token thật sau
tích hợp. Ngày ghi nhận: 2026-11-01.

## Mục tiêu và cách vận hành

- Giảm dung lượng browser lưu trên máy khi crawl nhiều acc/server.
- Người dùng tự chọn server và mở từng terminal; có thể chạy vài lượt song song,
  tăng mức song song từ từ khi thử nghiệm. Không chờ toàn bộ lượt kết thúc mới
  chạy lượt mới. Chưa cần scheduler, tự động crawl toàn bộ hay tự tăng concurrency.
- Server có mức ưu tiên và chu kỳ crawl khác nhau; hiện điều khiển bằng tay.
- Switch auth bằng dữ liệu SDK đã được người dùng POC thành công. Không nghiên
  cứu lại tính khả thi của switch cookie trong POC này.
- Đã xác nhận cách chọn acc: thay `userLoginData.value` bằng object của email
  chỉ định trong `allLoginList.value`, giữ các key khác. Tên `fullLoginlist` trong trao đổi chỉ tập dữ liệu đã login đủ;
  cần đối chiếu tên field thực khi triển khai, không giả định có hai schema.

## Dữ kiện và giới hạn

Đo 6 profile ngày 2026-11-01: tổng `Default/Cache` và `Default/Code Cache`
khoảng 3,67 GiB, chiếm hơn 97% dung lượng các profile được đo. Các profile có
dùng để chơi thêm có dung lượng lớn hơn. Phép đo xác định nơi chiếm dung lượng,
chưa xác định từng response là asset chung, dữ liệu riêng acc hay nội dung khác.

Luồng crawler hiện tại:

- [session.py](../../tools/socket_log/browser/session.py) mở persistent context;
  chặn service worker.
- [navigation.py](../../tools/socket_log/browser/navigation.py) điều hướng với
  `wait_until="commit"`, không chờ tải hết trang.
- [crawler.py](../../tools/socket_log/sea_socket/crawler.py) mặc định dùng payload
  entry; [phases.py](../../tools/socket_log/sea_socket/crawl/phases.py) chờ login
  rồi inject request, không cần thao tác UI map.
- Vẫn cần runtime game: socket do game mở, module đọc server và runtime decode
  leaderboard. Không thao tác UI không đồng nghĩa với không cần tải asset.
- [router.py](../../tools/socket_log/sea_socket/crawl/router.py) có timeout inject
  8 giây, request pacing và backoff cho phản hồi throttle từ server. Tải asset
  gây tranh băng thông/CPU là vấn đề khác với quota request phía server.

## Hướng A: nguồn auth chung, context không persistent cho từng lượt

1. Chuẩn bị một profile nguồn đã login đủ acc; xuất đúng phần auth cần thiết.
   Browser dùng profile nguồn phải đóng trước khi công cụ khác mở lại profile đó.
2. Mỗi terminal đọc bản auth chung thành bản riêng trong bộ nhớ.
3. `--acc` chọn acc và áp dụng code switch do người dùng cung cấp vào context
   riêng. Không ghi acc đang chọn trở lại nguồn auth chung giữa các terminal.
4. Nạp auth đúng origin trước khi SDK đọc nó, sau đó mới vào game, bắt socket,
   chờ login và crawl như hiện tại.
5. Đóng context sau crawl; không giữ kho dữ liệu game bền vững cho mỗi acc.

Ý nghĩa CLI còn cần chốt: nếu giữ `--profile` làm nguồn auth thì phải thể hiện
rõ thay đổi ý nghĩa, hoặc thêm arg nguồn auth riêng. Không được tiếp tục mở
`launch_persistent_context` cùng một path từ nhiều terminal. Lock profile hiện
có cũng phải được điều chỉnh theo tài nguyên thực sự được dùng.

Playwright mô tả non-persistent context không lưu dữ liệu duyệt web xuống đĩa;
điều này không đảm bảo toàn bộ browser/OS tuyệt đối không dùng file tạm hoặc swap.
Context mới phải tải lại tài nguyên; mức tốn băng thông, CPU, RAM và thời gian
khởi động cần đo thực tế trước khi chọn làm chế độ mặc định.

### Phép thử

- So sánh cùng acc/server giữa persistent có cache và context mới, trước hết
  không chặn asset, giữ nguyên pacing và cách crawl.
- Ghi thời gian từ navigation tới login, tới snapshot, tới hoàn tất; số timeout,
  retry throttle, completeness của dữ liệu và tổng byte HTTP nhận.
- Đo một lượt trước, sau đó vài lượt đồng thời do người dùng chủ động mở.
- Chỉ thử bỏ tài nguyên sau khi xác định nhóm URL không cần thiết. Không chặn
  toàn bộ ảnh, JSON hoặc binary theo đuôi file vì có thể phá bootstrap/retry.

## Hướng B đang nghiên cứu: nhiều persistent profile, asset dùng chung

Mỗi browser vẫn cần profile riêng khi chạy đồng thời. Mục tiêu là chia sẻ
response tài nguyên tĩnh ở tầng ngoài browser, không chia sẻ thư mục profile.

```text
Terminal A / persistent profile A ─┐
                                 ├─ kho asset chung → CDN khi cache miss
Terminal B / persistent profile B ─┘

Auth, API theo acc và WebSocket vẫn đi trực tiếp.
```

### Các phương án

| Phương án | Nhận định để POC |
| --- | --- |
| Symlink `Cache`/`Code Cache`, hoặc nhiều browser cùng `--disk-cache-dir` | Không chọn: chỉ trỏ chung nơi lưu chưa tạo cơ chế phối hợp index, ghi và eviction giữa các browser. Không có bảo đảm dùng đồng thời an toàn từ các nguồn đã kiểm tra. |
| Kho response tĩnh chung + Playwright route | Khả thi về API qua `route.fetch()` / `route.fulfill()`. Giữ URL gốc; các terminal đọc cùng kho file, khóa khi tải/ghi và publish file atomically. Đây là đề xuất, chưa thử trên game. |
| Cache proxy ngoài browser | Có thể làm tầng cache chung nhưng HTTPS cần giải pháp xử lý nội dung TLS; HTTP CONNECT thông thường không thấy response để cache. Phức tạp hơn cho POC hiện tại. |
| Clone profile/cache trên filesystem copy-on-write | Có thể giảm phần block vật lý ban đầu trên filesystem hỗ trợ; không phải cache sống dùng chung. Dữ liệu sẽ phân kỳ khi browser ghi/evict, cần đo riêng nếu thử. |

Điều kiện cho kho asset chung:

- Chỉ allowlist tài nguyên GET đã xác minh là dùng chung; không cache auth,
  response theo acc, WebSocket, hoặc coi mọi XHR/binary đều là asset.
- Key giữ URL đầy đủ gồm query/version và các biến thể response liên quan.
  Ưu tiên asset có hash/version bất biến; URL không đổi cần revalidation/TTL.
- Giữ status, content type và header cần thiết; xử lý nhất quán body đã giải nén
  với `Content-Encoding`/`Content-Length`. Response range, lỗi và redirect cần
  chính sách rõ ràng, ban đầu có thể cho đi trực tiếp.
- Khóa theo key khi cache miss; giới hạn dung lượng và dọn phiên bản cũ.
- Playwright routing vô hiệu HTTP cache. Điều này giúp tránh một lớp HTTP cache
  riêng nhưng không có nghĩa loại bỏ mọi `Code Cache`, GPU cache, IndexedDB hay
  dữ liệu do game ghi. Phải đo lại dung lượng profile sau POC.
- `Code Cache` là một khoản lớn trong phép đo; chia sẻ asset response không có
  nghĩa chia sẻ được phần code cache do browser tạo.

## Flow tích hợp

Helper [browser/auth.py](../../tools/socket_log/browser/auth.py) đọc JSON đầy đủ,
chọn acc theo email, giữ nguyên các key ngoài `userLoginData.value` và restore
localStorage tại origin SDK. File nguồn chỉ đọc; token không ghi vào meta.

```bash
uv run python tools/socket_log/sea_socket/crawler.py \
  --auth-json /path/to/auth.json --acc 'account@example.com' \
  --dump-out src/data/snapshots/261031/
```

- `--auth-json` và `--acc` phải đi cùng nhau, không kết hợp `--profile`.
  Không truyền hai arg này thì crawler vẫn dùng persistent profile như bình thường.
- Mỗi terminal mở browser/context fresh riêng, dùng chung file JSON chỉ đọc.
  Không acquire lock hoặc tạo persistent profile trong mode fresh.
- Restore ở tab SDK → cài send hook và WS listener trước game scripts → mở game
  → đóng tab auth → chờ login → xác minh username trong SDK frame của game
  → tiếp tục payload entry, crawl và dump theo engine hiện có.
- Context/browser đóng trong finally. JSON nguồn, raw crawl và dump vẫn giữ;
  storage browser của phiên fresh không giữ lại qua các lượt. Kill cưỡng bức
  hoặc crash có thể để lại file tạm, không đảm bảo cleanup trong trường hợp đó.
- Timeout navigation fresh 60 giây mỗi attempt trong `browser/auth.py`;
  timeout login cố định 180 giây trong `sea_socket/crawler.py`, không có arg
  login timeout. Không chờ tải hết asset bằng sleep hoặc networkidle.
- Raw output mặc định được tạo bằng thư mục unique. `--out` phải là thư mục mới
  để tránh hai run append vào cùng dữ liệu. `--dump-out` thư mục tách theo server;
  nếu cùng server hoặc cùng file đích thì lần ghi cuối vẫn thay thế file trước.
- Script POC riêng đã được thay bằng helper trong flow chính, không giữ hai bản
  logic switch auth. Hướng cache asset dùng chung vẫn là research, chưa triển khai.

## Kiểm chứng và điểm còn mở

Người dùng đã xác nhận POC chọn email/replace/restore/login hoạt động với token
thật. Bộ test tích hợp dùng Chrome với trang SDK/game và socket giả để kiểm tra
cách ly giữa hai acc, tab auth được đóng, hook inject chạy trước socket, cleanup
khi thành công/lỗi và mode persistent còn hoạt động. Không gọi game thật trong test.

```bash
uv run python -m unittest discover -s tools/socket_log/tests -v
```

- Cần chạy crawler tích hợp với token thật để đối chiếu đủ output, thời gian
  login/crawl và mức tải khi mở nhiều terminal.
- Auth trong JSON có thể hết hạn; hiện không refresh hoặc ghi ngược token.
- Username trong SDK frame là kiểm tra phía client, chưa phải đối chiếu danh
  tính nhân vật do server xác nhận. Server id vẫn đọc từ runtime để đặt tên dump.
- Chưa đo mức tăng RAM/băng thông của fresh context; chưa chặn asset hoặc làm
  cache chung. Các tối ưu này chỉ thử sau khi có số đo baseline.

## Nguồn

- [Playwright: persistent context và giới hạn user data directory](https://playwright.dev/python/docs/api/class-browsertype#browser-type-launch-persistent-context).
- [Playwright: non-persistent context](https://playwright.dev/python/docs/api/class-browsercontext).
- [Playwright: routing, HTTP cache và service workers](https://playwright.dev/python/docs/api/class-browsercontext#browser-context-route).
- [Playwright: route.fetch / route.fulfill](https://playwright.dev/python/docs/api/class-route).
- [Chromium: cấu trúc disk cache](https://www.chromium.org/developers/design-documents/network-stack/disk-cache/).

Mode persistent không xóa profile đang dùng; mode fresh tạo context tạm cho mỗi lượt.
