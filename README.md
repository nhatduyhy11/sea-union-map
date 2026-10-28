# Sea Union — Frontend (Web UI)

Giao diện Web tương tác hiển thị bản đồ chiến sự **Tranh Bá Tứ Hải** (Sea Union) và hệ thống bảng xếp hạng thời gian thực, xây dựng bằng **React 19**, **Vite** và **React Flow**.

Tài liệu này hướng dẫn chi tiết về cách chạy, tương tác, cấu trúc dữ liệu và tổ chức mã nguồn phía Frontend (`src/`). Để xem hướng dẫn về tầng crawler socket backend và luồng pipeline dữ liệu, xem [README.BE.md](README.BE.md).

---

## 1. Cài đặt & Chạy

Yêu cầu môi trường: **Node.js 18+** và `pnpm` (hoặc `npm`).

```sh
# Cài đặt dependencies
pnpm install

# Chạy dev server cục bộ (mặc định tại http://localhost:5173)
pnpm run dev

# Chạy kiểm thử đơn vị (domain, selectors, layout, data join)
pnpm test

# Build bản static phục vụ production (xuất ra dist/)
pnpm run build
```

---

## 2. Tương tác trên Giao diện

* **Điều hướng bản đồ (Canvas):**
  * Kéo giữ chuột trên nền để di chuyển (Pan).
  * Cuộn chuột hoặc pinch (trackpad) để thu phóng (Zoom).
  * Nút **Toàn cảnh** trên toolbar để căn chỉnh vừa màn hình (Fit view).
* **Tra cứu Cứ điểm / Đảo:**
  * **Hover / Focus:** Hiển thị điểm số hiện tại của 4 phe tại node.
  * **Click node:** Chọn đảo và mở panel chi tiết bên hông (thông tin boss, ngưỡng chiếm, bảng đóng góp người chơi).
  * **Ghim đảo:** Nút ghim trên từng đảo cho phép giữ bảng điểm cố định; tùy chọn **Điểm toàn map** bật/tắt toàn bộ bảng điểm đồng loạt.
  * **Tìm kiếm:** Ô tìm kiếm trên toolbar hỗ trợ nhảy nhanh tới vị trí đảo theo tên hoặc ID (ví dụ: `4`, `1-11`, `Đảo Lều Trại`).
* **Bảng Xếp Hạng & Bộ lọc (Leaderboard & Filter):**
  * Hệ thống gồm 3 tab chính: **Phe** (drill-down: Phe → Bang hội → Thành viên), **Cá nhân** (BXH điểm toàn server), **Cứ điểm** (xếp hạng đảo theo tổng điểm tranh đoạt).
  * **Cơ chế Filter mode:** Click vào một Bang hội hoặc Thành viên trên BXH sẽ tự động lọc và làm nổi bật (highlight) toàn bộ các đảo mà thực thể đó có đóng góp trên canvas.
  * Chi tiết đặc tả hành vi và cơ chế lọc được quy định tại [`docs/LEADERBOARD_SPECS.md`](docs/LEADERBOARD_SPECS.md).
* **Nhãn & Trạng thái:** Thanh chú giải (Legend) ở chân màn hình thể hiện màu sắc đại diện cho 4 phe và trạng thái trung lập.

---

## 3. Bản đồ & Dữ liệu Hiển thị

### Bố cục 89 Node
* Bản đồ bao gồm 89 node:
  * 24 đảo tầng 1 (vành ngoài).
  * 52 đảo tầng 2.
  * 9 cứ điểm chiến lược trên trục giữa: `3-7`, `3-5`, `3-3`, `3-1`, `4` (cứ điểm trung tâm - tâm toạ độ), `3-2`, `3-4`, `3-6`, `3-8`.
  * 4 cứ điểm căn cứ (Base): `base-north`, `base-east`, `base-south`, `base-west`.
* Toàn bộ vị trí toạ độ và 118 đường nối (routes) được định nghĩa chuẩn xác trong [`src/data/map-layout.ts`](src/data/map-layout.ts).

### Nguồn nạp dữ liệu (Data Source)
* **Live Data (Mặc định):** Dữ liệu được crawl từ server game và bake vào [`src/data/sea-live.json`](src/data/sea-live.json).
  * Adapter [`src/data/sea-live.ts`](src/data/sea-live.ts) thực hiện ánh xạ ID từ game sang ID bố cục layout canvas, nạp thông tin phe sở hữu (`owner`), điểm đóng góp từng cứ điểm (`contributions`) và bảng xếp hạng.
  * Khi chạy dev (`pnpm run dev`), nếu tồn tại file `public/sea-live-dev.json` (sinh ra từ crawler, gitignored), ứng dụng sẽ ưu tiên nạp file này để xem trước ngay mà không cần build lại.
  * Chi tiết về cơ chế nạp dev vs build xem [`docs/sea/SEA_LIVE_DATA.md`](docs/sea/SEA_LIVE_DATA.md).
* **Quy tắc tính toán đường nối & sở hữu:**
  * Phe sở hữu căn cứ và các đảo nối liên tục từ base được xác định thông qua logic duyệt đồ thị tại [`src/domain/claims.ts`](src/domain/claims.ts) theo quy tắc game tại [`docs/SEA_EVENT_RULE.md`](docs/SEA_EVENT_RULE.md).

---

## 4. Tổ chức Mã Nguồn (`src/`)

```
src/
├── components/          # Các React component giao diện
│   ├── layout/          # Header ứng dụng, thanh điều hướng (AppHeader, NavigationRail)
│   ├── map/             # Canvas React Flow, custom IslandNode, RouteEdge, toolbar, footer
│   ├── panels/          # Panel bên hông (Sidebar, NodeDetails, Leaderboard tabs)
│   └── shared/          # UI components tái sử dụng (PlayerIdentity, Watermark...)
├── stores/              # Quản lý trạng thái ứng dụng bằng Zustand
│   ├── mapView.ts       # State bộ lọc (guild/player), chế độ hiển thị điểm toàn map
│   ├── panel.ts         # State tab panel, sub-tab BXH, filterMode, accordion expansion
│   ├── selection.ts     # State chọn đảo, ghim đảo
│   ├── debug.ts         # Tùy chọn hỗ trợ debug canvas lúc dev
│   └── commands.ts      # Action handler điều phối nhiều store (openIsland, setFilterMode...)
├── hooks/               # Custom React hooks (useFitMap, useFocusIsland, v.v.)
├── domain/              # Logic nghiệp vụ thuần TypeScript (không phụ thuộc React)
│   ├── claims.ts        # Thuật toán kiểm tra connectivity đường nối từ base
│   ├── mapData.ts       # Điểm tập trung dữ liệu chuẩn bị cung cấp cho View layer
│   ├── mapGraph.ts      # Adapter chuyển đổi layout & claims sang Node/Edge của React Flow
│   └── selectors/       # Các hàm truy vấn, tính điểm, sắp xếp BXH và tìm kiếm
├── data/                # Dữ liệu tĩnh & adapter nạp data
│   ├── map-layout.ts    # Toạ độ 89 đảo và danh sách đường nối
│   ├── factions.ts      # Danh sách 4 phe và màu đại diện
│   ├── sea-live.ts      # Adapter chuyển đổi dữ liệu crawl sang model ứng dụng
│   └── sea-live.json    # Snapshot dữ liệu crawl chính thức (baked vào bundle)
├── types.ts             # Định nghĩa toàn bộ TypeScript Interfaces & Models
├── utils/format.ts      # Hàm tiện ích định dạng số, lực chiến, nhãn hiển thị
├── App.tsx              # Component gốc bố cục giao diện
├── main.tsx             # Entry point khởi tạo React DOM
└── style.css            # Global CSS reset & React Flow base styling
```

---

## 5. Nguyên tắc Kiến trúc

1. **Unidirectional Data Flow:** State được quản lý tập trung qua Zustand stores. Component chỉ subscribe theo slice nhỏ cần thiết để tối ưu hóa hiệu năng render (tránh re-render toàn bộ map khi pan/zoom).
2. **Domain Layer độc lập:** Thư mục `src/domain/` chứa các hàm xử lý dữ liệu và thuật toán thuần túy (pure functions), hoàn toàn không import React, UI components hay stores, đi kèm đầy đủ unit test trong `src/**/*.test.ts`.
3. **Co-located CSS Modules:** Mỗi component có file styles riêng biệt (ví dụ: `MapCanvas.module.css` nằm cạnh `MapCanvas.tsx`), đảm bảo tính đóng gói và không xung đột CSS class.
