import { FactionLegend } from "./FactionLegend";
import { SnapshotBar } from "./SnapshotBar";
import styles from "./MapFooter.module.css";

export function MapFooter() {
  return (
    <footer className={styles.mapFooter}>
      <div className={styles.footerMain}>
        <FactionLegend />
        <SnapshotBar />
      </div>
      <span className={styles.legendHelp}>Kéo để di chuyển · Cuộn để zoom</span>
    </footer>
  );
}
