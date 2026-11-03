import type { Faction } from "../types";

// Tên phe = tên base in-game (không dùng hướng Đông/Tây/Nam/Bắc). Thứ tự mảng
// là thứ tự hiển thị cố định (pill + list Tab Phe).
// Hai field màu vẫn tách để có thể đổi riêng sau này, nhưng hiện Owner chốt
// (2026-10-29) dùng chung một màu cho label và edge mỗi phe:
// - color: swatch/edge/viền đảo/icon căn cứ/bar điểm.
// - labelColor: mọi text label tên phe (pill, BXH, legend, tooltip, tag).
// Ngoại lệ: edgeColor (optional) đè màu edge canvas khi cần — chỉ north đặt,
// các phe còn lại edge dùng color.
export const factions: Faction[] = [
  {
    id: "east",
    name: "Vịnh Thao Thiết",
    color: "#1e9cf0",
    labelColor: "#1e9cf0",
  },
  {
    id: "south",
    name: "Long Khư U Ám",
    color: "#e8590c",
    labelColor: "#e8590c",
  },
  {
    id: "north",
    name: "Thần Tự Lấp Lánh",
    // Vàng node/label giữ màu chuẩn; riêng edge canvas đậm hơn một bậc vì ở
    // opacity 0.7 trên nền giấy màu gốc bị chìm, khó phân biệt với link trung lập.
    edgeColor: "#cc9a00",
    color: "#e6ad00",
    labelColor: "#e6ad00",
  },
  {
    id: "west",
    name: "Thánh Đảo Lạnh Giá",
    color: "#8e44d8",
    labelColor: "#8e44d8",
  },
];

// Vòng căn cứ ngược chiều kim đồng hồ trên map: Vịnh → Thần Tự → Thánh Đảo →
// Long Khư. Legend chân canvas và vòng chuyển căn cứ trong chi tiết căn cứ đi
// theo thứ tự này.
export const factionRing: Faction[] = ["east", "north", "west", "south"].map(
  (id) => factions.find((faction) => faction.id === id)!
);
