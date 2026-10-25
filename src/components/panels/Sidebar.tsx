import { Compass, Flag, RotateCcw, Trophy } from "lucide-react";
import { NodeDetails } from "./NodeDetails";
import { Leaderboard } from "./Leaderboard";
import styles from "./Sidebar.module.css";
import type {
  FactionBoardEntry,
  LeaderboardPlayer,
  NodeBoardEntry,
  NodeDetailData,
} from "../../types";
import type { RankingBoard, TacticalMapTab } from "../../hooks/useTacticalMap";

export interface SidebarProps {
  tab: TacticalMapTab;
  details: NodeDetailData | null;
  pinned: boolean;
  leaderboard: LeaderboardPlayer[];
  factionBoard: FactionBoardEntry[];
  nodeBoard: NodeBoardEntry[];
  filter: string;
  board: RankingBoard;
  onTabChange: (tab: TacticalMapTab) => void;
  onBoardChange: (board: RankingBoard) => void;
  onSelectFaction: (id: string) => void;
  onCloseIsland: () => void;
  onTogglePin: (id: string) => void;
  onFocusIsland: (id: string) => void;
  onClearPins: () => void;
}

export function Sidebar({
  tab,
  details,
  pinned,
  leaderboard,
  factionBoard,
  nodeBoard,
  filter,
  board,
  onTabChange,
  onBoardChange,
  onSelectFaction,
  onCloseIsland,
  onTogglePin,
  onFocusIsland,
  onClearPins,
}: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.tabs}>
        <button
          className={tab === "node" ? styles.selected : ""}
          onClick={() => onTabChange("node")}
        >
          <Flag size={15} /> Cứ điểm
        </button>
        <button
          className={tab === "ranking" ? styles.selected : ""}
          onClick={() => onTabChange("ranking")}
        >
          <Trophy size={15} /> Xếp hạng
        </button>
      </div>
      {tab === "ranking" ? (
        <Leaderboard
          board={board}
          players={leaderboard}
          factions={factionBoard}
          nodes={nodeBoard}
          factionFocus={filter}
          onBoardChange={onBoardChange}
          onSelectFaction={onSelectFaction}
          onFocusIsland={onFocusIsland}
        />
      ) : details ? (
        <NodeDetails
          details={details}
          pinned={pinned}
          onClose={onCloseIsland}
          onTogglePin={onTogglePin}
        />
      ) : (
        <div className={styles.empty}>
          <Compass size={40} />
          <h2>Khám phá chiến trường</h2>
          <p>Chọn một đảo trên map để xem điểm các phe và người chơi.</p>
        </div>
      )}
      <div className={styles.foot}>
        <span>
          <i /> Dữ liệu minh họa
        </span>
        <button
          title="Bỏ tất cả ghim"
          aria-label="Bỏ tất cả ghim"
          onClick={onClearPins}
        >
          <RotateCcw size={14} />
        </button>
        <small>Điểm tổng được tính từ đóng góp tại từng đảo.</small>
      </div>
    </aside>
  );
}
