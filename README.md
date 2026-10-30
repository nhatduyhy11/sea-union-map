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
* **Cụm server & Lịch sử theo ngày:**
  * **Server switcher** cạnh tiêu đề "Tranh bá Tứ Hải" (`[517]`, `[590]`…): danh sách cụm tự lấy từ các snapshot đã có, không có nút tạo mới. Đổi cụm sẽ reset view BXH (filter canvas + accordion).
  * **Thanh "Lịch sử"** 7 ngày event dưới legend: ngày hiện tại = live, ngày đã qua = snapshot cuối ngày, ngày chưa tới bị disable; ngày thiếu snapshot hiện flat, click báo toast lỗi.
  * Chi tiết nguồn data và rule quy ngày tại [`docs/sea/SEA_LIVE_DATA.md`](docs/sea/SEA_LIVE_DATA.md) (mục "Snapshot lịch sử theo ngày × cụm").

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
  * Adapter [`src/data/sea-live/join.ts`](src/data/sea-live/join.ts) (`buildLiveData(dump)`, hàm thuần) thực hiện ánh xạ ID từ game sang ID bố cục layout canvas, nạp thông tin phe sở hữu (`owner`), điểm đóng góp từng cứ điểm (`contributions`) và bảng xếp hạng.
  * [`src/domain/mapData.ts`](src/domain/mapData.ts) (`buildMapData(dump)`) derive model UI từ một dump; store [`src/stores/dataset.ts`](src/stores/dataset.ts) giữ bộ đang xem (cụm × ngày), component đọc qua `useMapData()`.
  * Khi chạy dev (`pnpm run dev`), nếu tồn tại file `public/sea-live-dev.json` (sinh ra từ crawler, gitignored), ứng dụng sẽ ưu tiên nạp file này để xem trước ngay mà không cần build lại.
  * Chi tiết về cơ chế nạp dev vs build xem [`docs/sea/SEA_LIVE_DATA.md`](docs/sea/SEA_LIVE_DATA.md).
* **Snapshot lịch sử:** `src/data/snapshots/<YYMMDD>/<server>.json`, nạp lazy qua [`src/data/snapshots.ts`](src/data/snapshots.ts) — xem [`docs/sea/SEA_LIVE_DATA.md`](docs/sea/SEA_LIVE_DATA.md).
* **Sở hữu node:**
  * Owner từng node lấy từ server (dump `owner`), server đã áp quy tắc ngưỡng và cắt đường tại [`docs/SEA_EVENT_RULE.md`](docs/SEA_EVENT_RULE.md); FE không tự tính đường nối.

---

## 4. Tổ chức Mã Nguồn (`src/`)

```
src/
├── components/          # Các React component giao diện
│   ├── layout/          # Header ứng dụng, thanh điều hướng (AppHeader, NavigationRail)
│   ├── map/             # Canvas React Flow, custom IslandNode, RouteEdge, toolbar, footer
│   ├── panels/          # Panel bên hông (Sidebar, NodeDetails, Leaderboard tabs)
│   └── shared/          # UI components tái sử dụng (PlayerIdentity, Watermark, ToastHost...)
├── stores/              # Quản lý trạng thái ứng dụng bằng Zustand
│   ├── dataset.ts       # Bộ data đang xem (cụm × ngày): live/snapshot, selectServer/selectDay, useMapData()
│   ├── toast.ts         # Toast thông báo ngắn (showToast), hiển thị qua ToastHost
│   ├── mapView.ts       # State bộ lọc (guild/player), chế độ hiển thị điểm toàn map
│   ├── panel.ts         # State tab panel, sub-tab BXH, filterMode, accordion expansion
│   ├── selection.ts     # State chọn đảo, ghim đảo
│   ├── debug.ts         # Tùy chọn hỗ trợ debug canvas lúc dev
│   └── commands.ts      # Action handler điều phối nhiều store (openIsland, setFilterMode...)
├── hooks/               # Custom React hooks (useFitMap, useFocusIsland, v.v.)
├── domain/              # Logic nghiệp vụ thuần TypeScript (không phụ thuộc React)
│   ├── mapData.ts       # buildMapData(dump): derive model UI (scores, BXH, index filter) từ một dump
│   ├── mapGraph.ts      # Adapter chuyển đổi layout & owner sang Node/Edge của React Flow
│   └── selectors/       # Các hàm truy vấn, tính điểm, sắp xếp BXH và tìm kiếm
├── data/                # Dữ liệu tĩnh & adapter nạp data
│   ├── map-layout.ts    # Toạ độ 89 đảo và danh sách đường nối
│   ├── factions.ts      # Danh sách 4 phe và màu đại diện
│   ├── sea-live.ts      # Entry nạp dump live (liveDump), re-export join
│   ├── sea-live/        # dump.ts: format dump; join.ts: chuyển dữ liệu crawl sang model ứng dụng (buildLiveData)
│   ├── sea-live.json    # Bản live chính thức cụm 517 (baked vào bundle)
│   ├── eventCalendar.ts # 7 ngày event + rule quy ngày snapshot (eventDayOf)
│   ├── snapshots.ts     # Quét snapshot lịch sử (import.meta.glob lazy), danh sách cụm
│   └── snapshots/       # <YYMMDD>/<server>.json — snapshot lịch sử theo ngày × cụm
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
