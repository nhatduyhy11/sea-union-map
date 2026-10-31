import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { compact, number } from "../../../utils/format";
import { PlayerIdentity } from "../../shared/PlayerIdentity";
import { togglePlayerFilter } from "../../../stores/commands";
import { usePanel } from "../../../stores/panel";
import { EASTER_EGG_PLAYER_ID, tapEasterEgg } from "../../../stores/debug";
import styles from "./shared.module.css";
import type { LeaderboardPlayer } from "../../../types";

// Tab Cá nhân: filter mode — accordion một player mở tại một thời điểm,
// player mở chính là filter canvas (cùng logic với member-click tab Phe).
// Đảo trong expand chỉ liệt kê + điểm — focus đảo là vai của tab Cứ điểm.
export function PlayerBoard({ players }: { players: LeaderboardPlayer[] }) {
  const filterMode = usePanel((state) => state.filterMode);
  const openPlayer = usePanel((state) => state.openPlayer);
  // Sort là state local — tự reset khi rời board (như sort guild Tab Phe).
  const [sortByPower, setSortByPower] = useState(false);

  // Bật: LC giảm dần (player không brief không LC → chạm đáy, giữ thứ tự
  // server). Tắt: thứ tự board server — số hạng đầu row vẫn là hạng server.
  const displayPlayers = useMemo(
    () =>
      sortByPower
        ? [...players].sort((a, b) => (b.power ?? 0) - (a.power ?? 0))
        : players,
    [players, sortByPower]
  );

  return (
    <>
      <h2>Xếp hạng cá nhân</h2>
      <div className={styles.sortBar}>
        <label
          className={styles.sortOption}
          title="Bật: sắp xếp theo Lực chiến (LC) giảm dần. Tắt: thứ tự BXH điểm server (mặc định). Số hạng đầu row luôn là hạng server."
        >
          <input
            type="checkbox"
            checked={sortByPower}
            onChange={(event) => setSortByPower(event.target.checked)}
          />
          Sắp xếp theo lực chiến
        </label>
      </div>
      {displayPlayers.map((player) => {
        // Easter egg: click liên tiếp dòng của dev mở picker màu (xem debug store).
        const onEasterEgg =
          player.id === EASTER_EGG_PLAYER_ID ? tapEasterEgg : undefined;
        const summary = (
          <>
            <span className={styles.rank}>{player.rank}</span>
            <PlayerIdentity
              player={player}
              faction={player.factionInfo}
              nodeCount={player.nodes}
              power={player.power}
              inline
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
                onEasterEgg?.();
              }}
            >
              {summary}
            </summary>
            {allocations}
          </details>
        ) : (
          <details key={player.id} className={styles.item}>
            <summary className={styles.summary} onClick={onEasterEgg}>
              {summary}
            </summary>
            {allocations}
          </details>
        );
      })}
    </>
  );
}
