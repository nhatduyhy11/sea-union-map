import { create } from "zustand";

export type MapTab = "node" | "ranking";
// Top tabs của bảng xếp hạng — thứ tự UI: Phe trước (aggregate chính),
// rồi Cá nhân, Cứ điểm.
export type RankingBoard = "faction" | "player" | "node";

// State UI của panel phải: tab đang mở, sub-tab bảng xếp hạng, ô tìm kiếm.
// Query nằm đây (không phải toolbar-local) vì focusIsland cần xoá nó cùng
// lúc với việc chuyển tab.
interface PanelState {
  tab: MapTab;
  board: RankingBoard;
  query: string;
  setTab: (tab: MapTab) => void;
  setBoard: (board: RankingBoard) => void;
  setQuery: (query: string) => void;
}

export const usePanel = create<PanelState>()((set) => ({
  tab: "node",
  board: "faction",
  query: "",
  setTab: (tab) => set({ tab }),
  setBoard: (board) => set({ board }),
  setQuery: (query) => set({ query }),
}));
