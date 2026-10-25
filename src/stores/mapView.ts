import { create } from "zustand";

// Filter/display state của canvas — mọi thứ quyết định map vẽ cái gì nhưng
// không đổi dữ liệu nào được chọn. Nơi tập hợp các chế độ lọc: thêm filter
// mode mới = thêm field + action ở đây, không đụng App hay component khác.
interface MapViewState {
  // Hiện cả đảo không thuộc phe đang lọc (toggle "Điểm toàn map").
  showAll: boolean;
  // Phe đang lọc: faction id, "neutral" (đảo không chủ), hoặc "all".
  filter: string;
  // Overlay dev (tâm node, trục giữa) — nút bật chỉ tồn tại ở DEV.
  debug: boolean;
  setShowAll: (showAll: boolean) => void;
  // Chọn phe ở legend/BXH là toggle: chọn lại phe đang chọn quay về "all".
  toggleFaction: (id: string) => void;
  toggleDebug: () => void;
}

export const useMapView = create<MapViewState>()((set) => ({
  showAll: false,
  filter: "all",
  debug: false,
  setShowAll: (showAll) => set({ showAll }),
  toggleFaction: (id) =>
    set((state) => ({ filter: state.filter === id ? "all" : id })),
  toggleDebug: () => set((state) => ({ debug: !state.debug })),
}));
