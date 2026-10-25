import { factions } from "../../data/factions";
import { selectFaction } from "../../stores/commands";
import { useMapView } from "../../stores/mapView";
import styles from "./FactionLegend.module.css";

export function FactionLegend() {
  const filter = useMapView((state) => state.filter);
  return (
    <footer className={styles.legend}>
      <button
        className={filter === "all" ? styles.chosen : ""}
        onClick={() => selectFaction("all")}
      >
        Tất cả
      </button>
      {factions.map((faction) => (
        <button
          key={faction.id}
          className={filter === faction.id ? styles.chosen : ""}
          onClick={() => selectFaction(faction.id)}
        >
          <i style={{ background: faction.color }} />
          {faction.name}
        </button>
      ))}
      <button
        className={`${styles.neutral} ${filter === "neutral" ? styles.chosen : ""}`}
        onClick={() => selectFaction("neutral")}
      >
        <i />
        Trung lập
      </button>
      <span className={styles.legendHelp}>Kéo để di chuyển · Cuộn để zoom</span>
    </footer>
  );
}
