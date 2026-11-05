import { create } from "zustand";
import { persist } from "zustand/middleware";

// Hero lấp chỗ trống ở 4 góc canvas — lớp riêng, chồng thêm lên ảnh góc
// trang trí cố định. Index 0..3 = góc trên-trái rồi theo chiều kim đồng hồ
// (trên-phải, dưới-phải, dưới-trái). x/y là tâm ảnh và width là bề ngang, đều
// theo px toạ độ map; file là đường dẫn trong public/, rỗng = ẩn. Picker DEV
// ghi đè và lưu localStorage để giữ qua F5.
export interface CornerConfig {
  file: string;
  x: number;
  y: number;
  width: number;
  opacity: number;
}

const OPACITY = 0.15;

export const CORNER_DEFAULTS: readonly CornerConfig[] = [
  { file: "hero/joker.webp", x: -2130, y: -1280, width: 800, opacity: OPACITY },
  { file: "hero/hanu.webp", x: 2120, y: -1270, width: 880, opacity: OPACITY },
  { file: "hero/loli.webp", x: 2120, y: 1260, width: 740, opacity: OPACITY },
  { file: "hero/rong.webp", x: -2140, y: 1250, width: 820, opacity: OPACITY },
];

// Ảnh chọn được trong popover: mỗi hero có bản gốc và bản lật ngang
// (-mirror). public/hero/ không liệt kê được lúc runtime nên khai báo tay.
const HEROES = ["codau", "hanu", "joker", "loli", "rong", "venom"];
export const CORNER_IMAGE_OPTIONS = HEROES.flatMap((name) => [
  `hero/${name}.webp`,
  `hero/${name}-mirror.webp`,
]);

interface CornerDebugState {
  corners: CornerConfig[];
  setCorner: (index: number, patch: Partial<CornerConfig>) => void;
  resetCorner: (index: number) => void;
}

export const useCornerDebug = create<CornerDebugState>()(
  persist(
    (set) => ({
      corners: CORNER_DEFAULTS.map((corner) => ({ ...corner })),
      setCorner: (index, patch) =>
        set((state) => ({
          corners: state.corners.map((corner, i) =>
            i === index ? { ...corner, ...patch } : corner
          ),
        })),
      resetCorner: (index) =>
        set((state) => ({
          corners: state.corners.map((corner, i) =>
            i === index ? { ...CORNER_DEFAULTS[index] } : corner
          ),
        })),
    }),
    // Bump version khi đổi CORNER_DEFAULTS để bỏ giá trị cũ đã lưu.
    { name: "sea-map:corner-debug", version: 2 }
  )
);
