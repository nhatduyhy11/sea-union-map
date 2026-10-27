import { create } from "zustand";

export type MapTab = "node" | "ranking";
// Top tabs của bảng xếp hạng — thứ tự UI: Phe trước (aggregate chính),
// rồi Cá nhân, Cứ điểm.
export type RankingBoard = "faction" | "player" | "node";

// State UI của panel phải: tab đang mở, sub-tab bảng xếp hạng, ô tìm kiếm.
// Query nằm đây (không phải toolbar-local) vì focusIsland cần xoá nó cùng
// lúc với việc chuyển tab.
//
// filterMode + expansion state của BXH cũng nằm đây (không local component)
// để command reset view chạm được từ một nơi: filterMode là state panel sống
// qua các lần đổi tab; openGuild/selectedMember/openFaction là accordion
// filter-mode của BXH (reset khi đổi board / rời ranking / collapse).
interface PanelState {
  tab: MapTab;
  board: RankingBoard;
  query: string;
  // BXH có side-effect lên canvas (mở row = lọc) hay thuần đọc. Default bật.
  filterMode: boolean;
  // Guild đang mở (accordion tab Phe, filter mode) — chính là filter canvas.
  openGuild: string | null;
  // Thành viên đang chọn trong guild mở (filter player); null = filter guild.
  selectedMember: string | null;
  // Player đang mở (accordion tab Cá nhân, filter mode) — filter canvas.
  openPlayer: string | null;
  // Faction row đang expand — thuần view, không filter.
  openFaction: string | null;
  setTab: (tab: MapTab) => void;
  setBoard: (board: RankingBoard) => void;
  setQuery: (query: string) => void;
  setFilterMode: (filterMode: boolean) => void;
  setOpenGuild: (guild: string | null) => void;
  setSelectedMember: (member: string | null) => void;
  setOpenPlayer: (player: string | null) => void;
  setOpenFaction: (faction: string | null) => void;
}

export const usePanel = create<PanelState>()((set) => ({
  // Vào app là BXH trước — người dùng nắm cục diện trước khi đụng map.
  tab: "ranking",
  board: "faction",
  query: "",
  filterMode: true,
  openGuild: null,
  selectedMember: null,
  openPlayer: null,
  openFaction: null,
  setTab: (tab) => set({ tab }),
  setBoard: (board) => set({ board }),
  setQuery: (query) => set({ query }),
  setFilterMode: (filterMode) => set({ filterMode }),
  setOpenGuild: (openGuild) => set({ openGuild }),
  setSelectedMember: (selectedMember) => set({ selectedMember }),
  setOpenPlayer: (openPlayer) => set({ openPlayer }),
  setOpenFaction: (openFaction) => set({ openFaction }),
}));
