import { Search, Layers, Crosshair, FilterX } from "lucide-react";
import { useFitMap } from "../../../hooks/useFitMap";
import { useFocusIsland } from "../../../hooks/useFocusIsland";
import { useIslandMatches } from "./useIslandMatches";
import { resetCanvasFilter } from "../../../stores/commands";
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
  const filter = useMapView((state) => state.filter);
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
      {/* Cụm phải: icon bỏ filter sát trái toggle Điểm toàn map — wrapper giữ
          margin-left:auto để nhóm luôn dính nhau bất kể icon có render hay không. */}
      <div className={styles.toolbarRight}>
        {filter && (
          <button
            className={styles.resetFilter}
            aria-label="Bỏ lọc"
            title="Bỏ lọc"
            onClick={resetCanvasFilter}
          >
            <FilterX size={16} />
          </button>
        )}
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
    </div>
  );
}
