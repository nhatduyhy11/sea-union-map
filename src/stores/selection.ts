import { create } from "zustand";

// Island selection — đảo nào đang mở chi tiết (selected) và đảo nào được giữ
// hiển thị bất chấp filter (pinned). Command focus (dời camera) không nằm
// store vì cần instance ReactFlow: xem hooks/useFocusIsland.ts.
interface SelectionState {
  selected: string | null;
  pinned: Set<string>;
  // Đảo đang được trỏ từ panel (chấm dot plot chi tiết căn cứ) — node tương
  // ứng trên canvas hiện viền hover như khi rê chuột trực tiếp.
  hovered: string | null;
  // Phe của căn cứ xem gần nhất, theo cụm server — đóng chi tiết đảo (✕) thì
  // tab Cứ điểm quay về căn cứ này thay vì căn cứ phe top 1.
  baseByServer: Record<string, string>;
  open: (id: string) => void;
  close: () => void;
  togglePin: (id: string) => void;
  hover: (id: string | null) => void;
  rememberBase: (server: string, factionId: string) => void;
}

export const useSelection = create<SelectionState>()((set) => ({
  // Vào app ở trạng thái trung lập — không mở chi tiết cứ điểm nào.
  selected: null,
  pinned: new Set<string>(),
  hovered: null,
  baseByServer: {},
  hover: (id) => set({ hovered: id }),
  open: (id) => set({ selected: id }),
  close: () => set({ selected: null }),
  togglePin: (id) =>
    set((state) => {
      const pinned = new Set(state.pinned);
      if (pinned.has(id)) pinned.delete(id);
      else pinned.add(id);
      return { pinned };
    }),
  rememberBase: (server, factionId) =>
    set((state) =>
      state.baseByServer[server] === factionId
        ? state
        : { baseByServer: { ...state.baseByServer, [server]: factionId } }
    ),
}));
