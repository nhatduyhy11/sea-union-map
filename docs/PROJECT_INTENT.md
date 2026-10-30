# Project intent — Web map chiến thuật và theo dõi điểm

## 1. Mục tiêu

Game đã có map và tracking, nhưng cách hiển thị hiện tại chưa đáp ứng nhu cầu theo dõi và bàn luận chiến thuật.

Web cần giúp:

- Có cái nhìn tổng quan về map, các phe và các cứ điểm.
- Dễ cùng nhau bàn luận chiến thuật dựa trên map.
- Theo dõi các top player đang phân bố điểm vào những cứ điểm nào để phục vụ quản lý.

Ràng buộc vận hành: web tĩnh, ưu tiên không có server; dữ liệu cập nhật định kỳ, không cần realtime.

## 2. Cấu trúc map

- 4 phe, base ở 4 hướng đông/tây/nam/bắc; lúc bắt đầu sự kiện mỗi phe chỉ có base của mình. Base không thể bị chiếm.
- Bố cục node và đường nối cố định theo ảnh game: người dùng không kéo được node, node không sinh thêm hay mất đi; chỉ điểm và trạng thái thay đổi.
- Node định danh bằng index, tên đảo không quan trọng.

Bố cục chi tiết (89 node, 118 đường nối) đã dựng trong code — xem README §3.

## 3. Thông tin tại một cứ điểm

### 3.1. Thông tin boss và điểm các phe

Tham chiếu: [node-camp-info](../specs/node-camp-info.PNG).

- Mỗi node có thông tin chi tiết về boss cứ điểm; thông tin này cố định.
- Điểm của các phe tại node thay đổi theo diễn biến sự kiện.

Quy tắc claim — ngưỡng điểm, đường nối từ base, tạm ngắt khi bị cắt và cách derive ownership — được ghi riêng tại [docs/SEA_EVENT_RULE.md](SEA_EVENT_RULE.md).

### 3.2. Bảng người chơi tấn công cứ điểm

Tham chiếu: [node-camp-board](../specs/node-camp-board.PNG).

- Mỗi node có bảng chi tiết các player tấn công, phe của họ và điểm họ đóng góp tại node đó.
- Node `1-8` trong ảnh là ví dụ minh họa cho một cứ điểm trên map.
- Dữ liệu này giúp nhìn được player nào đang phân bố bao nhiêu điểm vào từng cứ điểm.

## 4. Bảng thống kê tổng

Tham chiếu: [leaderboard](../specs/leaderboard.jpeg).

- Có một board thống kê tổng điểm của các player trên toàn bộ các node.
- Kết hợp board tổng với dữ liệu từng node để theo dõi phân bố điểm của các top player.

## 5. Nguồn dữ liệu và quy tắc đối chiếu điểm

Dữ liệu game (ảnh feed, server trả về) là nguồn sự thật; web hiển thị đúng những gì server trả, không tự bù số.

Server chỉ trả một phần dữ liệu chi tiết (node-board chỉ top player mỗi node, leaderboard chỉ top toàn server), nên **không** kỳ vọng các nguồn cộng khớp nhau:

- Tổng điểm player trong node-board của một phe có thể **nhỏ hơn** điểm phe đó trong node-info.
- Tổng điểm một player qua các node có thể không bằng điểm của player đó trên leaderboard tổng.

Chủ dự án chấp nhận độ lệch này. Top-20/node đã verify là server cắt, không lấy thêm được: [docs/sea/SOCKET_PROTOCOL.md](sea/SOCKET_PROTOCOL.md) §3.5.
