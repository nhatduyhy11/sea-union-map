import { MapHeading } from "./MapHeading";
import { MapToolbar } from "./MapToolbar";
import styles from "./MapHeader.module.css";

export function MapHeader() {
  return (
    <header className={styles.mapHeader}>
      <MapHeading />
      <MapToolbar />
    </header>
  );
}
