import { factions } from "../../../data/factions";
import { getFactionIcon } from "../../shared/factionIcons";
import styles from "./FactionLegend.module.css";

// Legend chỉ đọc: icon đại diện + label (labelColor) các phe để đối chiếu màu và căn cứ trên
// canvas. Không còn hành vi filter — filter guild/player điều khiển từ BXH.
export function FactionLegend() {
  return (
    <div className={styles.legend}>
      {factions.map((faction) => {
        const Icon = getFactionIcon(faction.id);
        return (
          <span
            key={faction.id}
            className={styles.entry}
            style={{ color: faction.labelColor }}
          >
            {Icon ? (
              <Icon size={14} className={styles.icon} />
            ) : (
              <i style={{ background: faction.color }} />
            )}
            {faction.name}
          </span>
        );
      })}
    </div>
  );
}
