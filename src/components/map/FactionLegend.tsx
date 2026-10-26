import { factions } from "../../data/factions";
import styles from "./FactionLegend.module.css";

// Legend chỉ đọc: swatch màu + label các phe để đối chiếu màu node trên
// canvas. Không còn hành vi filter — filter guild/player điều khiển từ BXH.
export function FactionLegend() {
  return (
    <footer className={styles.legend}>
      {factions.map((faction) => (
        <span key={faction.id} className={styles.entry}>
          <i style={{ background: faction.color }} />
          {faction.name}
        </span>
      ))}
      <span className={styles.legendHelp}>Kéo để di chuyển · Cuộn để zoom</span>
    </footer>
  );
}
