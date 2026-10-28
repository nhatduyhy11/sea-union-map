# Project intent — Web map chiến thuật và theo dõi điểm

## 1. Trạng thái của tài liệu

Đây là bản tổ chức lại mục tiêu, nhu cầu và ràng buộc của chủ dự án, được cập nhật khi có mô tả mới. Bố cục map, cách chạy và tổ chức code nằm trong [README.md](../README.md); những phần chưa được mô tả được để mở.

## 2. Mục tiêu

Game đã có map và tracking, nhưng cách hiển thị hiện tại chưa đáp ứng nhu cầu theo dõi và bàn luận chiến thuật.

Web cần giúp:

- Có cái nhìn tổng quan về map, các phe và các cứ điểm.
- Dễ cùng nhau bàn luận chiến thuật dựa trên map.
- Theo dõi các top player đang phân bố điểm vào những cứ điểm nào để phục vụ quản lý.

## 3. Định hướng vận hành

- Đây là một web.
- Chủ dự án dự định dùng React.
- Ưu tiên không có server.
- Nếu cần fetch dữ liệu định kỳ, có thể dùng GitHub Actions chạy cron job; không cần realtime.
- Giai đoạn đầu sẽ nhập/feed dữ liệu thủ công, đặc biệt là điểm của các phe tại từng cứ điểm.
- Chưa chốt cơ chế fetch hay tự động hóa input.

## 4. Cấu trúc map

### 4.1. Bốn phe và base

- Map có 4 phe.
- Base của 4 phe nằm ở 4 hướng: đông, tây, nam, bắc.
- Lúc bắt đầu sự kiện, mỗi phe chỉ có một điểm chính tại góc/hướng tương ứng của mình.
- Base của mỗi phe không thể bị chiếm.
- [Ảnh map-base](../specs/map-base.PNG) là hình tham chiếu cho một base/khu vực base.

### 4.2. Khu vực trung tâm

- Vùng được khoanh trong [ảnh map-2](../specs/map-2.PNG) là phần tham chiếu cho 1/4 khu vực trung tâm.
- Các phần còn lại của khu vực trung tâm đối xứng theo bốn phía.
- Map có các cứ điểm (node) để người chơi của các phe tấn công.
- Bố cục node cố định, không phải lưới grid đều. Người dùng không di chuyển được các node.
- Các node không được sinh thêm hay mất đi trong quá trình sử dụng; dữ liệu điểm và trạng thái có thể thay đổi.
- Đã có ảnh toàn map ghép từ [trái](../specs/map-left.PNG), [giữa](../specs/map-mid.PNG), [phải](../specs/map-right.PNG); dùng index để định danh, tên đảo không quan trọng. Bốn khu vực đối xứng quanh cứ điểm giữa, không phải bốn cụm demo xoay quanh một node tự thêm. Hai index ở hàng giữa còn cần xác nhận; xem README.

## 5. Thông tin tại một cứ điểm

### 5.1. Thông tin boss và điểm các phe

Tham chiếu: [node-camp-info](../specs/node-camp-info.PNG).

- Mỗi node có thông tin chi tiết về boss cứ điểm; thông tin này cố định.
- Điểm của các phe tại node thay đổi theo diễn biến sự kiện.
- Trước mắt cập nhật điểm thủ công.

Quy tắc claim — ngưỡng điểm, đường nối từ base, tạm ngắt khi bị cắt và cách derive ownership — được ghi riêng tại [docs/SEA_EVENT_RULE.md](SEA_EVENT_RULE.md).

### 5.2. Bảng người chơi tấn công cứ điểm

Tham chiếu: [node-camp-board](../specs/node-camp-board.PNG).

- Mỗi node có bảng chi tiết các player tấn công, phe của họ và điểm họ đóng góp tại node đó.
- Node `1-8` trong ảnh là ví dụ minh họa cho một cứ điểm trên map.
- Dữ liệu này giúp nhìn được player nào đang phân bố bao nhiêu điểm vào từng cứ điểm.

## 6. Bảng thống kê tổng

Tham chiếu: [leaderboard](../specs/leaderboard.jpeg).

- Có một board thống kê tổng điểm của các player trên toàn bộ các node.
- Kết hợp board tổng với dữ liệu từng node để theo dõi phân bố điểm của các top player.

## 7. Nguồn dữ liệu và quy tắc đối chiếu điểm

Các hình được feed từ game là nguồn sự thật tuyệt đối (absolute truth).

Hai quan hệ dữ liệu cần đúng:

1. Tổng điểm của một player trên tất cả các node phải bằng điểm của player đó trên leaderboard tổng.
2. Tại một node, tổng điểm của các player thuộc cùng một phe trong node-board phải bằng điểm của phe đó trong node-info.

Biểu diễn ngắn gọn:

```text
Với mỗi player:
  Tổng điểm player tại tất cả node = Điểm player trên leaderboard

Với mỗi phe tại mỗi node:
  Tổng điểm các player thuộc phe tại node = Điểm phe trong node-info
```

Chưa chốt cách xử lý khi dữ liệu nhập chưa đủ hoặc các nguồn điểm không khớp nhau.

## 8. Phạm vi ý tưởng hiện tại

Trọng tâm trước mắt là map để overview và bàn luận chiến thuật, kèm dữ liệu điểm theo phe/player tại từng cứ điểm và leaderboard tổng. Input ban đầu được feed tay.

Các chi tiết về giao diện, cách nhập dữ liệu, mô hình dữ liệu, tự động hóa và triển khai sẽ được bổ sung khi chủ dự án mô tả tiếp.

## 9. Phase 1 — Dựng bố cục map và tương tác node

### 9.1. Mục tiêu đã nêu

- Bắt đầu bằng việc dựng mạng node và đường nối giống bố cục trong ảnh tham chiếu.
- Giữ cố định vị trí các node và các kết nối, gồm khu vực base và khu vực trung tâm đối xứng bốn phía.
- Mỗi node có icon và có thể click hoặc hover để xem thống kê của các phe đang đánh tại node đó.
- Mỗi node có toggle để bật/tắt hiển thị thông tin tại node.
- Có một tùy chọn chung để hiển thị thông tin của tất cả các node cùng lúc.
- Khi thông tin tại node không được bật thường trực, hover vào vẫn hiển thị thông tin.

### 9.2. Những điểm còn để mở

- ~~Xác nhận index đầy đủ của hai cứ điểm giữa có tiền tố `3-`, `4-`~~: đã xác nhận qua NC-01 (Khách Sạn Cực Lạc là ID `4`, Thành Địa Nghỉ Dưỡng là ID `3-1`, dải cứ điểm giữa gồm `3-1` đến `3-8` và `4`).
- Cách trình bày bảng thông tin để vẫn đọc được khi bật tất cả node cùng lúc.
- Hành vi click cụ thể và quan hệ giữa toggle riêng với tùy chọn hiển thị toàn bộ.
- Nhu cầu zoom/pan và cách tương tác trên thiết bị cảm ứng.

### 9.3. Phạm vi demo đã được yêu cầu

- Chủ dự án yêu cầu dựng demo sơ dựa trên intent và quyết định công nghệ ban đầu.
- Cho phép đánh số đảo tạm bằng index theo dạng `d-dd`; ID và đường nối chính xác sẽ bổ sung sau khi có ảnh map đầy đủ.
- Những lựa chọn giao diện và tương tác trong demo là phương án thử nghiệm để xem và phản hồi, chưa được coi là yêu cầu cuối cùng.

### 9.4. Cập nhật từ ảnh toàn map

Chủ dự án đã cung cấp ba ảnh trái/giữa/phải và yêu cầu dùng index thật, bố cục bốn khu vực đối xứng quanh cứ điểm giữa. Demo đã thay bố cục tạm bằng tọa độ và đường nối đọc từ ảnh. Tên node không cần chép chính xác; dữ liệu điểm vẫn là minh họa.
