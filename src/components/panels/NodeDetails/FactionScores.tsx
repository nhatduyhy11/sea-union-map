import { number } from "../../../utils/format";
import styles from "./FactionScores.module.css";
import type { FactionScore } from "../../../types";

export interface FactionScoresProps {
  scores: FactionScore[];
  total: number;
}

export function FactionScores({ scores, total }: FactionScoresProps) {
  return (
    <div className={styles.factionScores}>
      {scores.map((faction) => {
        return (
          <div key={faction.id}>
            <div>
              <span style={{ color: faction.labelColor }}>
                <i style={{ background: faction.color }} />
                {faction.name}
              </span>
              <b>{number(faction.score)}</b>
            </div>
            <div className={styles.barTrack}>
              <div
                style={{
                  width: `${total ? (faction.score / total) * 100 : 0}%`,
                  background: faction.color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
