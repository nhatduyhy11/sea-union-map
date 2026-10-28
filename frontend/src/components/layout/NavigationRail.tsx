import { Map, Trophy, Compass } from "lucide-react";
import { useFitMap } from "../../hooks/useFitMap";
import { setPanelTab } from "../../stores/commands";
import styles from "./NavigationRail.module.css";

export function NavigationRail() {
  const fitMap = useFitMap();
  return (
    <nav className={styles.rail}>
      <button
        className={styles.railActive}
        title="Bản đồ"
        aria-label="Bản đồ"
        onClick={fitMap}
      >
        <Map />
      </button>
      <button
        title="Bảng xếp hạng"
        aria-label="Bảng xếp hạng"
        onClick={() => setPanelTab("ranking")}
      >
        <Trophy />
      </button>
      <div className={styles.railBottom}>
        <Compass size={22} />
      </div>
    </nav>
  );
}
