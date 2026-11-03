import { create } from "zustand";
import type { MapFilter } from "../domain/mapGraph";

// Filter/display state của canvas — mọi thứ quyết định map vẽ cái gì nhưng
// không đổi dữ liệu nào được chọn. Nơi tập hợp các chế độ lọc: thêm filter
// mode mới = thêm field + action ở đây, không đụng App hay component khác.
interface MapViewState {
  // Hiện cả đảo không thuộc phe đang lọc (toggle "Điểm toàn map").
  showAll: boolean;
  // Filter guild/player đang bật; null = all. Chỉ BXH ghi (legend đã
  // display-only) — một filter tại một thời điểm.
  filter: MapFilter | null;
  // Tập đảo được highlight trực tiếp (filter trạng thái ở chi tiết căn cứ);
  // khi bật thì thay cho filter guild/player. null = không highlight.
  nodeHighlight: ReadonlySet<string> | null;
  setShowAll: (showAll: boolean) => void;
  setFilter: (filter: MapFilter | null) => void;
  // Toggle: chọn lại filter đang bật quay về all.
  toggleFilter: (filter: MapFilter) => void;
  resetFilter: () => void;
  setNodeHighlight: (ids: ReadonlySet<string> | null) => void;
}

const sameFilter = (a: MapFilter, b: MapFilter) =>
  a.kind === b.kind && a.id === b.id;

export const useMapView = create<MapViewState>()((set) => ({
  showAll: false,
  filter: null,
  nodeHighlight: null,
  setShowAll: (showAll) => set({ showAll }),
  setFilter: (filter) => set({ filter }),
  toggleFilter: (filter) =>
    set((state) => ({
      filter: state.filter && sameFilter(state.filter, filter) ? null : filter,
    })),
  resetFilter: () => set({ filter: null }),
  setNodeHighlight: (nodeHighlight) => set({ nodeHighlight }),
}));
