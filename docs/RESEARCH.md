# Research — Hướng dựng map chiến thuật

## 1. Trạng thái và phạm vi

Chủ dự án đã chốt dùng **React Flow** để dựng map trên React. Không tiếp tục khảo sát hướng tự dựng SVG.

Tài liệu này ghi quyết định công nghệ, cơ sở lựa chọn và những hướng triển khai đang cân nhắc. Đây chưa phải specs hoặc kế hoạch triển khai. Yêu cầu sản phẩm nằm trong [PROJECT_INTENT.md](../PROJECT_INTENT.md).

## 2. Quyết định đã chốt

- Dùng React cho giao diện web.
- Dùng React Flow (`@xyflow/react`) để hiển thị mạng node và đường nối.
- Bố cục dùng tọa độ cố định theo map game, không tự sắp xếp lại node.
- React Flow phục vụ việc xem và tương tác với map; người dùng không chỉnh sửa cấu trúc map.

## 3. Cơ sở lựa chọn

React Flow có sẵn các khả năng quản lý viewport như zoom, pan và fit map, cùng callback cho tương tác node. Việc có sẵn các khả năng này thuận lợi cho phát triển map có nhiều cứ điểm. Nhu cầu và hành vi zoom/pan cụ thể của sản phẩm vẫn chưa chốt.

Custom node có thể viết bằng component React, nên icon, tên đảo, bảng điểm và toggle có thể xây bằng UI React/CSS thông thường.

Node cố định vẫn phù hợp với React Flow: khai báo vị trí node và khóa các thao tác chỉnh sửa. Không cần chức năng thêm/xóa node hay tạo đường nối của một trình biên tập graph.

Nguồn chính thức:

- [React Flow API: viewport, sự kiện và cấu hình tương tác](https://reactflow.dev/api-reference/react-flow).
- [Custom nodes: xây nội dung node bằng component React](https://reactflow.dev/learn/customization/custom-nodes).
- [Node type: ID, position và dữ liệu node](https://reactflow.dev/api-reference/types/node).

## 4. Hướng triển khai đề xuất

Các ý dưới đây là đề xuất kỹ thuật, chưa phải chi tiết đã chốt.

### Dữ liệu map

- Mô tả bố cục bằng danh sách node có ID và tọa độ, cùng danh sách đường nối giữa các ID.
- Tách bố cục cố định khỏi dữ liệu boss, điểm phe và điểm player.
- Cập nhật điểm không làm thay đổi tọa độ hay kết nối.
- Dùng đường nối thẳng để bám bố cục ảnh tham chiếu.

### Hiển thị và tương tác

- Tạo custom component `IslandNode` cho icon, tên cứ điểm và toggle thông tin.
- Khóa kéo node, tạo kết nối, nối lại đường và xóa phần tử.
- Quản lý riêng trạng thái hover, node được click, các node được ghim thông tin và tùy chọn hiển thị toàn bộ.
- Bảng stat tóm tắt hiển thị điểm của các phe cạnh node.
- Toggle riêng có thể dùng để ghim bảng stat; khi chưa ghim, hover vẫn hiển thị bảng.
- Cách mở chi tiết khi click và hành vi của toggle toàn map cần chốt sau.

React Flow hỗ trợ phần hiển thị và tương tác map. Logic điểm, nội dung bảng stat, ghim thông tin và hiển thị tất cả vẫn do ứng dụng xây dựng.

## 5. Các điểm cần tìm hiểu hoặc chốt tiếp

- Bố cục và index đã được đọc từ ảnh toàn map trái/giữa/phải; xác nhận hai index trung tâm chưa đọc đầy đủ.
- Khi bật tất cả stat, cách bố trí bảng để tránh chồng lấn và vẫn đọc được.
- Bảng stat nên co giãn theo zoom hay giữ kích thước chữ trên màn hình.
- Click mở thông tin ở đâu và khác hover như thế nào.
- Quan hệ giữa toggle từng node và toggle toàn map.
- Hành vi zoom/pan và cách xem thông tin trên thiết bị cảm ứng.
- Cách feed dữ liệu thủ công; chưa chọn cơ chế nhập hay lưu dữ liệu.

## 6. Demo phase 1 đã triển khai

Theo yêu cầu dựng demo sơ, repo đã có React + Vite + React Flow. [README](../README.md) mô tả cách chạy và giới hạn.

Các phương án thử nghiệm đã dùng: click mở panel bên cạnh, ghim từng đảo độc lập với tùy chọn toàn map, bảng stat co giãn theo zoom, pan/zoom và fit map, lọc phe bằng cách làm mờ đảo khác. Không kéo/đổi node hoặc chỉnh đường nối. Leaderboard và điểm phe suy ra từ đóng góp mẫu của player.

Bố cục tạm đã được thay bằng `src/data/map-layout.ts`, chứa index và tọa độ ghép từ ba ảnh toàn map, với các đường nối đọc từ ảnh. Dải cứ điểm giữa gồm đầy đủ `3-1` đến `3-8` và `4` (NC-01); toàn bộ tên node được chuẩn hóa theo index (`Cứ điểm ${id}` và `Đảo ${id}`). Boss, phe sở hữu và điểm vẫn là dữ liệu minh họa. Những lựa chọn hành vi này cần phản hồi từ chủ dự án trước khi coi là thiết kế cuối cùng.

## 7. Tổ chức code React

Theo yêu cầu của chủ dự án, UI và logic được phân tách: `main.tsx` chỉ mount ứng dụng; `App.tsx` thuần layout; `components/` render UI và tự subscribe store; `stores/` (zustand) quản lý state theo slice, `stores/commands.ts` + `hooks/` giữ tương tác; `domain/` giữ truy vấn và tính điểm thuần; `data/` giữ bố cục và fixture. Cấu trúc chi tiết nằm trong README. Câu hỏi cần xác nhận được ghi vào `NEED_CONFIRM.md` trước khi hỏi.
