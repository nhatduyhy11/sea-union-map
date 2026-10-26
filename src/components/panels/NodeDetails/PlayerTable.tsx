import { number } from "../../../utils/format";
import { PlayerIdentity } from "../../shared/PlayerIdentity";
import styles from "./PlayerTable.module.css";
import type { Attacker } from "../../../types";

export interface PlayerTableProps {
  attackers: Attacker[];
}

export function PlayerTable({ attackers }: PlayerTableProps) {
  return (
    <div className={styles.playerTable}>
      <div className={styles.tableHead}>
        <span>NGƯỜI CHƠI / PHE</span>
        <span>ĐIỂM</span>
      </div>
      {attackers.map((entry, index) => (
        <div className={styles.playerRow} key={entry.playerId}>
          <span className={styles.rank}>
            {String(index + 1).padStart(2, "0")}
          </span>
          <PlayerIdentity player={entry.player} faction={entry.factionInfo} />
          <b>{number(entry.score)}</b>
        </div>
      ))}
    </div>
  );
}
