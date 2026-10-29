import { setFilterMode, setRankingBoard } from "../../../stores/commands";
import { useMapData } from "../../../stores/dataset";
import { usePanel } from "../../../stores/panel";
import { FactionBoard } from "./FactionBoard";
import { NodeBoard } from "./NodeBoard";
import { PlayerBoard } from "./PlayerBoard";
import styles from "./Leaderboard.module.css";

// Mirrors the in-game BXH screen (SEA_STRUCTURE.md §3.2): 3 tab với thứ tự UI
// Phe → Cá nhân → Cứ điểm (game để Cứ điểm trước — owner muốn Phe lên đầu vì
// là aggregate chính); tab Phe chia "chung" + một sub-tab mỗi phe.
export function Leaderboard() {
  const board = usePanel((state) => state.board);
  const filterMode = usePanel((state) => state.filterMode);
  const { factionBoard, leaderboard, nodeBoard } = useMapData();
  return (
    <div className={`${styles.detail} ${styles.ranking}`}>
      <div className={styles.rankingHead}>
        <span className={styles.eyebrow}>TOÀN CHIẾN TRƯỜNG</span>
        <label
          className={styles.filterMode}
          title="Bật: mở dòng là lọc canvas (một dòng tại một thời điểm). Tắt: chỉ đọc, không đụng canvas."
        >
          <input
            type="checkbox"
            checked={filterMode}
            onChange={(event) => setFilterMode(event.target.checked)}
          />
          Filter mode
        </label>
      </div>
      <div className={styles.boardTabs}>
        <button
          className={board === "faction" ? styles.selected : ""}
          onClick={() => setRankingBoard("faction")}
        >
          Phe
        </button>
        <button
          className={board === "player" ? styles.selected : ""}
          onClick={() => setRankingBoard("player")}
        >
          Cá nhân
        </button>
        <button
          className={board === "node" ? styles.selected : ""}
          onClick={() => setRankingBoard("node")}
        >
          Cứ điểm
        </button>
      </div>
      {board === "faction" ? (
        <FactionBoard factions={factionBoard} />
      ) : board === "player" ? (
        <PlayerBoard players={leaderboard} />
      ) : (
        <NodeBoard nodes={nodeBoard} factions={factionBoard} />
      )}
    </div>
  );
}
