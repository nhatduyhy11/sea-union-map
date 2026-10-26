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
        // Scores from factions cut off from their base never claim the node,
        // so mark them instead of letting the raw number mislead.
        const suspended = faction.connected === false && faction.score > 0;
        return (
          <div key={faction.id} className={suspended ? styles.suspended : ""}>
            <div>
              <span>
                <i style={{ background: faction.color }} />
                {faction.name}
              </span>
              <b>
                {number(faction.score)}
                {suspended && (
                  <em title="Mất đường nối tới căn cứ — điểm tạm không xét để chiếm node">
                    {" "}
                    ngắt
                  </em>
                )}
              </b>
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
