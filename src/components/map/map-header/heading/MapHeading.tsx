import { MapDebugControls } from "../debug/MapDebugControls";
import { EventClock } from "./EventClock";
import { ServerSwitcher } from "./ServerSwitcher";
import styles from "./MapHeading.module.css";

export function MapHeading() {
  return (
    <div className={styles.mapHeading}>
      <div className={styles.topRow}>
        <div>
          <div className={styles.eyebrow}>CHIẾN TRƯỜNG / TỔNG QUAN</div>
          <h1 className={styles.title}>Tranh bá Tứ Hải</h1>
        </div>
        <div className={styles.headingMeta}>
          <MapDebugControls />
        </div>
      </div>
      <div className={styles.serverRow}>
        <ServerSwitcher />
        <EventClock />
      </div>
    </div>
  );
}
