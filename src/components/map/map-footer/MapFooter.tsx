import { FactionLegend } from "./FactionLegend";
import { SnapshotBar } from "./SnapshotBar";
import styles from "./MapFooter.module.css";
import { HistoryProgress } from "./HistoryControls";

export function MapFooter() {
  return (
    <footer className={styles.mapFooter}>
      <div className={styles.footerMain}>
        <div className={styles.legendRow}>
          <FactionLegend />
          <HistoryProgress />
        </div>
        <SnapshotBar />
      </div>
      <span className={styles.legendHelp}>Kéo để di chuyển · Cuộn để zoom</span>
    </footer>
  );
}
