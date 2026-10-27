import { create } from "zustand";
import type { MapFilter } from "../types";

// Filter/display state của canvas — mọi thứ quyết định map vẽ cái gì nhưng
// không đổi dữ liệu nào được chọn. Nơi tập hợp các chế độ lọc: thêm filter
// mode mới = thêm field + action ở đây, không đụng App hay component khác.
interface MapViewState {
  // Hiện cả đảo không thuộc phe đang lọc (toggle "Điểm toàn map").
  showAll: boolean;
  // Filter guild/player đang bật; null = all. Chỉ BXH ghi (legend đã
  // display-only) — một filter tại một thời điểm.
  filter: MapFilter | null;
  // Overlay dev (tâm node, trục giữa) — nút bật chỉ tồn tại ở DEV.
  debug: boolean;
  // Màu nền canvas — chỉnh qua color picker debug (chỉ có ở DEV), có thể
  // mang alpha #rrggbbaa; prod chạy nguyên giá trị mặc định.
  canvasBg: string;
  // Màu chung nhóm trung lập (edge không thuộc phe + đảo chưa chiếm) — cùng
  // cơ chế picker debug như canvasBg. Opacity 0..1 áp chung cả nhóm.
  neutralColor: string;
  neutralOpacity: number;
  setShowAll: (showAll: boolean) => void;
  setFilter: (filter: MapFilter | null) => void;
  // Toggle: chọn lại filter đang bật quay về all.
  toggleFilter: (filter: MapFilter) => void;
  resetFilter: () => void;
  toggleDebug: () => void;
  setCanvasBg: (bg: string) => void;
  setNeutralColor: (color: string) => void;
  setNeutralOpacity: (opacity: number) => void;
}

const sameFilter = (a: MapFilter, b: MapFilter) =>
  a.kind === b.kind && a.id === b.id;

export const useMapView = create<MapViewState>()((set) => ({
  showAll: false,
  filter: null,
  debug: false,
  canvasBg: "#fefdfa",
  neutralColor: "#9caeb9",
  neutralOpacity: 0.4,
  setShowAll: (showAll) => set({ showAll }),
  setFilter: (filter) => set({ filter }),
  toggleFilter: (filter) =>
    set((state) => ({
      filter: state.filter && sameFilter(state.filter, filter) ? null : filter,
    })),
  resetFilter: () => set({ filter: null }),
  toggleDebug: () => set((state) => ({ debug: !state.debug })),
  setCanvasBg: (canvasBg) => set({ canvasBg }),
  setNeutralColor: (neutralColor) => set({ neutralColor }),
  setNeutralOpacity: (neutralOpacity) => set({ neutralOpacity }),
}));
