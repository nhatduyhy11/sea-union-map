import { number } from "../../../utils/format";
import { PlayerIdentity } from "../../shared/PlayerIdentity";
import styles from "./PlayerTable.module.css";
import type { Attacker } from "../../../domain/selectors/nodeScores";

export interface PlayerTableProps {
  attackers: Attacker[];
  faction?: string | null;
}

export function PlayerTable({ attackers, faction }: PlayerTableProps) {
  const [powerSort, setPowerSort] = useState<"neutral" | "desc" | "asc">(
    "neutral"
  );
  const rows = attackers
    .map((entry, index) => ({ entry, rank: index + 1 }))
    .filter(({ entry }) => !faction || entry.faction === faction);
  if (powerSort !== "neutral") {
    rows.sort((a, b) => {
      const aPower = a.entry.player?.power ?? a.entry.power ?? 0;
      const bPower = b.entry.player?.power ?? b.entry.power ?? 0;
      return powerSort === "desc" ? bPower - aPower : aPower - bPower;
    });
  }
  const SortIcon =
    powerSort === "desc"
      ? ArrowDown
      : powerSort === "asc"
        ? ArrowUp
        : ArrowUpDown;
  const sortLabel =
    powerSort === "desc"
      ? "Lực chiến: cao đến thấp"
      : powerSort === "asc"
        ? "Lực chiến: thấp đến cao"
        : "Thứ tự mặc định";
  return (
    <div className={styles.playerTable}>
      <div className={styles.tableHead}>
        <span className={styles.playerHeading}>
          NGƯỜI CHƠI
          <button
            type="button"
            className={`${styles.sortButton} ${powerSort !== "neutral" ? styles.sortActive : ""}`}
            aria-label={`${sortLabel}. Bấm để ${powerSort === "neutral" ? "sắp xếp lực chiến giảm dần" : powerSort === "desc" ? "sắp xếp lực chiến tăng dần" : "khôi phục thứ tự mặc định"}`}
            title={sortLabel}
            onClick={() =>
              setPowerSort((current) =>
                current === "neutral"
                  ? "desc"
                  : current === "desc"
                    ? "asc"
                    : "neutral"
              )
            }
          >
            <SortIcon size={12} />
          </button>
        </span>
        <span>ĐIỂM</span>
      </div>
      {rows.map(({ entry, rank }) => (
        <div className={styles.playerRow} key={entry.playerId}>
          <span className={styles.rank}>{String(rank).padStart(2, "0")}</span>
          <PlayerIdentity
            player={entry.player}
            faction={entry.factionInfo}
            power={entry.player?.power ?? entry.power}
            inline
          />
          <b>{number(entry.score)}</b>
        </div>
      ))}
      {rows.length === 0 && (
        <p className={styles.empty}>Không có người chơi trong danh sách.</p>
      )}
    </div>
  );
}
import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
