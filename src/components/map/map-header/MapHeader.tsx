import { MapHeading } from "./heading/MapHeading";
import { MapToolbar } from "./toolbar/MapToolbar";
import styles from "./MapHeader.module.css";

export function MapHeader() {
  return (
    <header className={styles.mapHeader}>
      <MapHeading />
      <MapToolbar />
    </header>
  );
}
