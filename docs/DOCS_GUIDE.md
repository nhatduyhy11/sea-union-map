# Docs guide

## Mục đích

Đây là điểm bắt đầu để người và AI đọc, cập nhật tài liệu của dự án. Guide mô tả vai trò của từng tài liệu và cách giữ yêu cầu, đề xuất, quyết định nhất quán.

## Tài liệu hiện có

| Tài liệu                                                        | Vai trò                                                                                   | Khi nào cập nhật                                                    |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [PROJECT_INTENT.md](PROJECT_INTENT.md)                          | Mục tiêu sản phẩm, nhu cầu, ràng buộc và phạm vi mong muốn                                | Khi chủ dự án bổ sung hoặc thay đổi yêu cầu                         |
| [docs/SEA_EVENT_RULE.md](SEA_EVENT_RULE.md)                     | Quy tắc game về chiếm cứ điểm: ngưỡng, đường nối, tạm ngắt, derive ownership              | Khi chủ dự án bổ sung hoặc thay đổi rule                            |
| [docs/sea/SEA_LIVE_DATA.md](sea/SEA_LIVE_DATA.md)               | Các file JSON crawl sea (`dump` vs `baked`), cái nào được dùng lúc dev, lúc build/deploy  | Khi thêm/đổi file JSON data hoặc đổi cơ chế nạp data của `src/data/sea-live.ts` |
| [docs/sea/SEA_STRUCTURE.md](sea/SEA_STRUCTURE.md)               | Cấu trúc event Tranh Bá Tứ Hải: luồng điều hướng, màn hình, dữ liệu node, quy tắc crawl   | Khi mô tả event thay đổi hoặc crawl xác nhận thêm dữ liệu           |
| [docs/LEADERBOARD_SPECS.md](LEADERBOARD_SPECS.md)               | Đặc tả BXH, cơ chế lọc guild/player canvas, filter mode và tương tác UI/UX                | Khi thay đổi cơ chế lọc bản đồ hoặc tương tác BXH                   |
| [docs/sea/SOCKET_PROTOCOL.md](sea/SOCKET_PROTOCOL.md)           | Tham chiếu protocol WS: framing, module/cmd, kết quả decode                               | Khi decode thêm module/cmd hoặc chốt một nghi vấn                   |
| [docs/sea/SEA_PACKET_ANALYSE.md](sea/SEA_PACKET_ANALYSE.md)     | Phân tích packet sea: module/cmd, config node, NEED_CONFIRM                               | Khi decode thêm packet sea hoặc chốt một nghi vấn                   |
| [docs/sea/BACKLOG_SEA.md](sea/BACKLOG_SEA.md)                   | Kế hoạch & các việc tồn đọng nhánh Tranh Bá Tứ Hải & Web UI                               | Khi phát hiện hoặc chốt việc cần làm của nhánh sea                  |
| [docs/mine_docs/MINE_STRUCTURE.md](mine_docs/MINE_STRUCTURE.md) | Cấu trúc event mỏ (Khai Thác Guild): map UI ↔ protocol                                    | Khi capture mới xác minh thêm field                                 |
| [docs/mine_docs/BACKLOG_MINE.md](mine_docs/BACKLOG_MINE.md)     | Backlog nhánh phụ Khai Thác Guild (hợp nhất toàn bộ open issues mỏ)       | Khi phát hiện việc cần làm ở nhánh mỏ                               |
| [specs/](../specs/)                                             | Ảnh tham chiếu từ game, làm căn cứ cho map và dữ liệu điểm                                | Khi có thêm ảnh hoặc cập nhật nguồn từ game                         |
| [DOCS_GUIDE.md](DOCS_GUIDE.md)                                  | Chỉ dẫn đọc và tổ chức tài liệu                                                           | Khi thêm, chuyển hoặc đổi vai trò tài liệu                          |
| [README.FE.md](../README.FE.md)                                 | Hướng dẫn chi tiết Web UI: setup FE, tương tác bản đồ, tổ chức thư mục src/ và state      | Khi thay đổi cấu trúc code FE hoặc tương tác UI                     |
| [README.md](../README.md)                                       | Tổng quan dự án: web UI, crawler socket WS (`tools/socket_log/`), usage, luồng crawl → UI | Khi thêm tool capture/decode, thay đổi luồng dữ liệu hoặc lệnh chạy |

Thư mục `specs/` hiện chứa ảnh tham chiếu; tên thư mục không có nghĩa là đã có specs triển khai.

## Thứ tự đọc

1. Đọc guide này để biết tài liệu nào chứa thông tin cần thiết.
2. Đọc `PROJECT_INTENT.md` để hiểu mục tiêu và phạm vi.
3. Đọc `README.md` (các mục Crawler / Luồng crawl → UI) hoặc `README.FE.md` (Web UI, map, tương tác) / `docs/LEADERBOARD_SPECS.md` khi làm việc với giao diện web, map hoặc luồng dữ liệu.
4. Đọc `docs/SEA_EVENT_RULE.md` khi làm việc với ownership, điểm claim hoặc connectivity.
5. Đọc `docs/sea/SEA_STRUCTURE.md` khi làm việc với event Tranh Bá Tứ Hải (crawl dữ liệu hoặc feed UI).
6. Đọc `docs/sea/SOCKET_PROTOCOL.md` / `docs/mine_docs/MINE_STRUCTURE.md` khi làm việc với tầng bắt socket và decode.
7. Xem các ảnh được liên kết khi công việc liên quan tới bố cục map hoặc dữ liệu game.

## Cách ghi nội dung mới

- **Yêu cầu đã xác nhận:** điều chủ dự án muốn sản phẩm làm; ghi vào intent.
- **Quyết định đã chốt:** lựa chọn đã được chủ dự án xác nhận; ghi vào spec hoặc README tương ứng.
- **Đề xuất:** hướng AI hoặc người làm đưa ra nhưng chưa được chốt; ghi rõ là đề xuất trong plan/spec.
- **Điểm còn mở:** thông tin thiếu hoặc hành vi chưa rõ; ghi ở tài liệu liên quan kèm nguồn, phương án tạm và trạng thái, không tự biến thành yêu cầu đã xác nhận.

Ví dụ hiện tại: node cố định, hover/click và toggle thông tin là yêu cầu; React Flow là lựa chọn công nghệ đã chốt; cách trình bày bảng stat và hành vi click chi tiết vẫn còn mở.

## Giữ tài liệu nhất quán

- Mỗi nội dung chi tiết có một nơi chính để cập nhật; tài liệu khác liên kết tới đó thay vì sao chép.
- Khi đề xuất được chốt, cập nhật trạng thái tại chỗ để không còn vừa ghi “đề xuất” vừa ghi “đã chốt” cho cùng một lựa chọn.
- Khi có yêu cầu hoặc quyết định mới thay thế nội dung cũ, cập nhật các phần liên quan và chỉ giữ lịch sử nếu nó giải thích một tradeoff còn hữu ích.
- Nếu yêu cầu mới mâu thuẫn tài liệu cũ, ưu tiên chỉ dẫn rõ ràng mới nhất của chủ dự án và sửa tài liệu cho khớp. Nếu chưa rõ ý, đánh dấu điểm còn mở.
- Ảnh feed từ game là nguồn sự thật cho dữ liệu game. Dữ liệu mẫu, phần suy đoán hoặc thông tin không đọc được phải được ghi rõ; không coi chúng là dữ liệu đã xác nhận.
- Ghi nguồn cho kết quả research; tách nhận định của người làm khỏi điều nguồn tài liệu xác nhận.

## Trạng thái hiện tại và tài liệu về sau

Hiện dự án đã có intent, web UI React Flow trong `src/`, pipeline crawler socket WS và đặc tả bảng xếp hạng / lọc canvas ([docs/LEADERBOARD_SPECS.md](LEADERBOARD_SPECS.md)). Tham khảo [README.md](../README.md) và [README.FE.md](../README.FE.md) để chạy và xem phạm vi đã triển khai.

Chỉ bổ sung tài liệu khi công việc cần đến:

- **Specs:** mô tả hành vi cụ thể và tiêu chí nghiệm thu khi cần làm rõ yêu cầu.
- **Plan:** các bước triển khai cho phạm vi đã được yêu cầu thực hiện.
- **AGENTS.md:** hướng dẫn vận hành AI trong repo, như tài liệu cần đọc, lệnh chạy và kiểm tra. Guide này là tài liệu thông thường; không mặc định được công cụ AI tự nạp.

Việc ghi nhận một ý tưởng hoặc chốt thư viện không tự mở rộng công việc thành triển khai. Tiếp tục theo phạm vi chủ dự án yêu cầu ở từng bước.
