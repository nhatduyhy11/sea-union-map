import type { Faction } from "../types";

// Tên phe = tên base in-game (không dùng hướng Đông/Tây/Nam/Bắc). Thứ tự mảng
// là thứ tự hiển thị cố định (pill + list Tab Phe, legend chân canvas).
// Hai màu tách biệt (Owner chốt 2026-10-28):
// - color: swatch/edge/viền đảo/icon căn cứ/bar điểm.
// - labelColor: mọi text label tên phe (pill, BXH, legend, tooltip, tag).
export const factions: Faction[] = [
  {
    id: "east",
    name: "Vịnh Thao Thiết",
    color: "#9a63d8",
    labelColor: "#1e9cf0",
  },
  {
    id: "south",
    name: "Long Khư U Ám",
    color: "#54a5d8",
    labelColor: "#e03131",
  },
  {
    id: "north",
    name: "Thần Tự Lấp Lánh",
    color: "#e54a26",
    labelColor: "#e6ad00",
  },
  {
    id: "west",
    name: "Thánh Đảo Lạnh Giá",
    color: "#d1a41c",
    labelColor: "#8e44d8",
  },
];
