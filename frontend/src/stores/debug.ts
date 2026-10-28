import { create } from "zustand";

// State phục vụ debug/tinh chỉnh giao diện trong môi trường DEV.
// Tách khỏi mapView để giữ mapView thuần lọc/hiển thị bản đồ cho người dùng.
interface DebugState {
  // Overlay dev (tâm node, trục giữa) — nút bật chỉ tồn tại ở DEV.
  debug: boolean;
  // Màu nền canvas — chỉnh qua color picker debug (chỉ có ở DEV), có thể
  // mang alpha #rrggbbaa; prod chạy nguyên giá trị mặc định.
  canvasBg: string;
  // Màu chung nhóm trung lập (edge không thuộc phe + đảo chưa chiếm) — cùng
  // cơ chế picker debug như canvasBg. Opacity 0..1 áp chung cả nhóm.
  neutralColor: string;
  neutralOpacity: number;
  toggleDebug: () => void;
  setCanvasBg: (bg: string) => void;
  setNeutralColor: (color: string) => void;
  setNeutralOpacity: (opacity: number) => void;
}

export const useDebug = create<DebugState>()((set) => ({
  debug: false,
  canvasBg: "#fefdfa",
  neutralColor: "#9caeb9",
  neutralOpacity: 0.4,
  toggleDebug: () => set((state) => ({ debug: !state.debug })),
  setCanvasBg: (canvasBg) => set({ canvasBg }),
  setNeutralColor: (neutralColor) => set({ neutralColor }),
  setNeutralOpacity: (neutralOpacity) => set({ neutralOpacity }),
}));
