import { Search, Layers, Crosshair } from "lucide-react";
import { useFitMap } from "../../../hooks/useFitMap";
import { useFocusIsland } from "../../../hooks/useFocusIsland";
import { useIslandMatches } from "../../../hooks/useIslandMatches";
import { useMapView } from "../../../stores/mapView";
import { usePanel } from "../../../stores/panel";
import styles from "./MapToolbar.module.css";

export function MapToolbar() {
  const fitMap = useFitMap();
  const focusIsland = useFocusIsland();
  const query = usePanel((state) => state.query);
  const setQuery = usePanel((state) => state.setQuery);
  const showAll = useMapView((state) => state.showAll);
  const setShowAll = useMapView((state) => state.setShowAll);
  const matches = useIslandMatches();
  return (
    <div className={styles.toolbar}>
      <div className={styles.search}>
        <Search size={16} />
        <input
          aria-label="Tìm đảo"
          placeholder="Tìm số đảo hoặc tên…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {matches.length > 0 && (
          <div className={styles.searchResults}>
            {matches.map((island) => (
              <button key={island.id} onClick={() => focusIsland(island.id)}>
                {island.id}
                <span>{island.name}</span>
              </button>
            ))}
          </div>
        )}
        {query && !matches.length && (
          <div className={`${styles.searchResults} ${styles.emptyResult}`}>
            Không tìm thấy đảo
          </div>
        )}
      </div>
      <label className={styles.showAll}>
        <Layers size={16} /> Điểm toàn map
        <input
          type="checkbox"
          checked={showAll}
          onChange={(event) => setShowAll(event.target.checked)}
        />
        <span className={styles.switch} />
      </label>
      <button className={styles.fit} onClick={fitMap}>
        <Crosshair size={16} /> Toàn cảnh
      </button>
    </div>
  );
}
