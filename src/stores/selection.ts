import { create } from "zustand";

// Island selection — đảo nào đang mở chi tiết (selected) và đảo nào được giữ
// hiển thị bất chấp filter (pinned). Command focus (dời camera) không nằm
// store vì cần instance ReactFlow: xem hooks/useFocusIsland.ts.
interface SelectionState {
  selected: string | null;
  pinned: Set<string>;
  open: (id: string) => void;
  close: () => void;
  togglePin: (id: string) => void;
}

export const useSelection = create<SelectionState>()((set) => ({
  // Vào app ở trạng thái trung lập — không mở chi tiết cứ điểm nào.
  selected: null,
  pinned: new Set<string>(),
  open: (id) => set({ selected: id }),
  close: () => set({ selected: null }),
  togglePin: (id) =>
    set((state) => {
      const pinned = new Set(state.pinned);
      if (pinned.has(id)) pinned.delete(id);
      else pinned.add(id);
      return { pinned };
    }),
}));
