import { FactionLegend } from "./FactionLegend";
import styles from "./MapFooter.module.css";

export function MapFooter() {
  return (
    <footer className={styles.mapFooter}>
      <FactionLegend />
      <span className={styles.legendHelp}>Kéo để di chuyển · Cuộn để zoom</span>
    </footer>
  );
}
