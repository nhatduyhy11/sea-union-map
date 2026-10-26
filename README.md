# Sea Union · Demo phase 1

Demo React + React Flow chạy hoàn toàn phía trình duyệt.

```sh
npm install
npm run dev
```

Mở URL local Vite in ra. `npm run build` tạo bản static trong `dist/`; `npm test` kiểm tra cấu trúc map và đối chiếu điểm.

## Thử demo

- Kéo nền để pan, cuộn/pinch để zoom, nút **Toàn cảnh** để fit map.
- Hover hoặc focus đảo để xem điểm bốn phe; click icon mở panel chi tiết.
- Nút ghim từng đảo giữ bảng điểm; **Điểm toàn map** hiện mọi bảng. Tắt tùy chọn chung vẫn giữ các đảo được ghim riêng.
- Lọc canvas theo guild hoặc thành viên trực tiếp từ BXH (xem [docs/LEADERBOARD_SPECS.md](docs/LEADERBOARD_SPECS.md)); legend chân map hiển thị màu phe.
- Tìm ID/tên đảo để tới đảo; tab xếp hạng mở phân bố điểm của từng player và liên kết tới cứ điểm.

## Map theo ảnh đầy đủ

Map hiện có 89 node: 24 đảo tầng 1, 52 đảo tầng 2, 9 cứ điểm trên hàng giữa và 4 base. `src/data/map-layout.ts` chứa ID, tọa độ ghép từ `specs/map-left.PNG`, `map-mid.PNG`, `map-right.PNG` và 118 đường nối đọc từ ảnh. Tọa độ được phóng đồng đều để giữ tỷ lệ bố cục và khoảng cách. Không sinh map bằng cách xoay một cụm node; các index thật được khai báo riêng ở đúng khu vực trong ảnh.

Cứ điểm trung tâm là `4` — là tâm tọa độ của map. Dãy cứ điểm trục giữa gồm 9 node theo index từ tây sang đông: `3-7`, `3-5`, `3-3`, `3-1`, `4` (tâm), `3-2`, `3-4`, `3-6`, `3-8`. Toàn bộ tên node được chuẩn hóa theo index (`Đảo 1-x`, `Đảo 2-x`, `Cứ điểm 3-x/4`). Các base không có index trong ảnh nên dùng ID nội bộ `base-north/east/south/west`.

Tên đảo dùng index; tên, boss, phe sở hữu và điểm vẫn là dữ liệu mẫu, chưa chép trạng thái game. Bốn base không có điểm tấn công. Bảng điểm co giãn theo zoom; zoom gần hơn để đọc.

`src/data/demo.ts` giữ đóng góp mẫu của player. Các hàm thuần trong `src/domain/selectors.ts` tính điểm phe và leaderboard từ cùng nguồn để khớp hai quan hệ trong intent. Chưa có nhập dữ liệu, lưu trạng thái hay đồng bộ giữa người dùng. Ghim, lọc và các lựa chọn chỉ tồn tại trong phiên trang hiện tại.

## Tổ chức code

- `src/main.tsx`: khởi tạo React và nạp CSS.
- `src/App.tsx`: bố cục ứng dụng — thuần layout, component tự nối store nên không threaded props.
- `src/components/layout/`: header và thanh điều hướng.
- `src/components/map/`: map, custom node/edge, toolbar, bảng điểm nhỏ và chú giải.
- `src/components/panels/`: panel cứ điểm, bảng điểm phe, player và leaderboard.
- `src/components/shared/`: UI dùng chung.
- `src/stores/`: zustand store chia theo loại state — `mapView` (lọc guild/player, điểm toàn map, debug), `panel` (tab, sub-tab BXH, filterMode, accordion expansion), `selection` (chọn/ghim đảo); `commands.ts` gom tương tác chạm nhiều store (`openIsland`, `setFilterMode`, `resetRankingView`). Chi tiết mô hình tương tác tại [docs/LEADERBOARD_SPECS.md](docs/LEADERBOARD_SPECS.md).
- `src/hooks/`: derived data và command cần instance React Flow — `useMapGraph` (nodes/edges), `useNodeDetails`, `useIslandMatches`, `useFocusIsland`, `useFitMap`.
- `src/domain/`: hàm thuần tính điểm, truy vấn chi tiết, tìm kiếm và chuyển dữ liệu sang model React Flow; kèm test.
- `src/data/`: bố cục theo ảnh, định nghĩa phe và fixture demo.
- `src/types.ts`: định nghĩa kiểu dữ liệu (model, props, React Flow node data).
- `src/utils/format.ts`: định dạng số để hiển thị.
- `src/style.css`: global CSS reset, typography, scrollbar và React Flow styles; UI dùng CSS Modules co-located theo từng component.

UI nhận dữ liệu đã chuẩn bị qua props; component subscribe store theo slice nên mỗi tương tác chỉ re-render vùng liên quan. Command chạm nhiều store nằm ở `stores/commands.ts`; command cần camera (focus/fit) là hook vì cần instance React Flow. Domain không import React, component hay store. Derived data (nodes/edges, chi tiết đảo, kết quả tìm kiếm) memo theo state đầu vào; điểm và leaderboard không tính lại theo mỗi thao tác pan/zoom.

Câu hỏi cần chủ dự án xác nhận được ghi vào [NEED_CONFIRM.md](NEED_CONFIRM.md) trước khi hỏi.
