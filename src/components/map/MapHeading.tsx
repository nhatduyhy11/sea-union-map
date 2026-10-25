import { baseCount, ownedIslands } from "../../domain/mapData";
import { useMapView } from "../../stores/mapView";
import styles from "./MapHeading.module.css";

export function MapHeading() {
  const debug = useMapView((state) => state.debug);
  const toggleDebug = useMapView((state) => state.toggleDebug);
  return (
    <div className={styles.mapHeading}>
      <div>
        <div className={styles.eyebrow}>CHIẾN TRƯỜNG / TỔNG QUAN</div>
        <h1 className={styles.title}>
          Đại hải trình<span>01</span>
        </h1>
      </div>
      <div className={styles.headingMeta}>
        {/* Debug chỉ dành cho dev — Vite thay import.meta.env.DEV bằng false khi
            build, nên nút (và overlay tâm node) bị loại khỏi bundle prod. */}
        {import.meta.env.DEV && (
          <button
            className={`${styles.debugToggle} ${debug ? styles.debugOn : ""}`}
            onClick={toggleDebug}
            aria-pressed={debug}
            title="Hiện tâm node + đường dash ngang qua node 4 và đường dọc qua các cứ điểm trục giữa"
          >
            Debug tâm node
          </button>
        )}
        <div className={styles.mapCount}>
          <b>{ownedIslands.length - baseCount}</b> cứ điểm <span>·</span>{" "}
          <b>{baseCount}</b> căn cứ
        </div>
      </div>
    </div>
  );
}
