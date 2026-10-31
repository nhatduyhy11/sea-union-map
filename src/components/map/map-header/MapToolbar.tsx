import { Search, Layers, Crosshair, RotateCcw } from "lucide-react";
import { useFitMap } from "../../../hooks/useFitMap";
import { useFocusIsland } from "../../../hooks/useFocusIsland";
import { useIslandMatches } from "./useIslandMatches";
import { resetAll } from "../../../stores/commands";
import { useMapView } from "../../../stores/mapView";
import { usePanel } from "../../../stores/panel";
import { useSelection } from "../../../stores/selection";
import styles from "./MapToolbar.module.css";

export function MapToolbar() {
  const fitMap = useFitMap();
  const focusIsland = useFocusIsland();
  const query = usePanel((state) => state.query);
  const setQuery = usePanel((state) => state.setQuery);
  const openGuild = usePanel((state) => state.openGuild);
  const openPlayer = usePanel((state) => state.openPlayer);
  const openFaction = usePanel((state) => state.openFaction);
  const showAll = useMapView((state) => state.showAll);
  const setShowAll = useMapView((state) => state.setShowAll);
  const filter = useMapView((state) => state.filter);
  const selected = useSelection((state) => state.selected);
  const matches = useIslandMatches();
  // Nút reset tổng chỉ render khi có trạng thái tạm để dọn (chi tiết đảo,
  // ô tìm kiếm, filter canvas, expansion BXH).
  const hasResettable = Boolean(
    selected || query || filter || openGuild || openPlayer || openFaction
  );
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
      {/* Cụm phải: nút reset tổng (icon reload) sát trái toggle Điểm toàn map —
          wrapper giữ margin-left:auto để nhóm luôn dính nhau bất kể nút có
          render hay không. */}
      <div className={styles.toolbarRight}>
        {hasResettable && (
          <button
            className={styles.reset}
            aria-label="Reset"
            title="Reset — đóng chi tiết, bỏ lọc, xoá tìm kiếm"
            onClick={resetAll}
          >
            <RotateCcw size={16} />
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
