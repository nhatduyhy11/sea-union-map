import { ChevronRight } from "lucide-react";
import { compact, number } from "../../../utils/format";
import { PlayerIdentity } from "../../shared/PlayerIdentity";
import { togglePlayerFilter } from "../../../stores/commands";
import { usePanel } from "../../../stores/panel";
import styles from "./shared.module.css";
import type { LeaderboardPlayer } from "../../../types";

// Tab Cá nhân: filter mode — accordion một player mở tại một thời điểm,
// player mở chính là filter canvas (cùng logic với member-click tab Phe).
// Đảo trong expand chỉ liệt kê + điểm — focus đảo là vai của tab Cứ điểm.
export function PlayerBoard({ players }: { players: LeaderboardPlayer[] }) {
  const filterMode = usePanel((state) => state.filterMode);
  const openPlayer = usePanel((state) => state.openPlayer);
  return (
    <>
      <h2>Xếp hạng cá nhân</h2>
      <p>
        BXH điểm server (top-200). Mở rộng: đảo đóng góp ghép từ BXH từng cứ
        điểm.
      </p>
      {players.map((player, index) => {
        const summary = (
          <>
            <span className={styles.rank}>{index + 1}</span>
            <PlayerIdentity
              player={player}
              faction={player.factionInfo}
              nodeCount={player.nodes}
            />
            <b>{compact(player.score)}</b>
            <ChevronRight size={13} />
          </>
        );
        const allocations = (
          <div className={styles.allocation}>
            {player.allocations.map((entry) => (
              <div key={entry.nodeId} className={styles.guildRow}>
                <span>Đảo {entry.nodeId}</span>
                <b>{number(entry.score)}</b>
              </div>
            ))}
          </div>
        );
        return filterMode ? (
          <details
            key={player.id}
            className={styles.item}
            open={openPlayer === player.id}
          >
            <summary
              className={styles.summary}
              onClick={(event) => {
                event.preventDefault();
                togglePlayerFilter(player.id);
              }}
            >
              {summary}
            </summary>
            {allocations}
          </details>
        ) : (
          <details key={player.id} className={styles.item}>
            <summary className={styles.summary}>{summary}</summary>
            {allocations}
          </details>
        );
      })}
    </>
  );
}
