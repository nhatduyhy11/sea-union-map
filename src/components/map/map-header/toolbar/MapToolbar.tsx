import { Search, Layers, Crosshair, RotateCcw } from "lucide-react";
import { useFitMap } from "../../../../hooks/useFitMap";
import { useIslandSearch } from "./useIslandSearch";
import { resetAll } from "../../../../stores/commands";
import { useMapView } from "../../../../stores/mapView";
import { usePanel } from "../../../../stores/panel";
import { useSelection } from "../../../../stores/selection";
import styles from "./MapToolbar.module.css";

const scrollIntoViewRef = (element: HTMLButtonElement | null) =>
  element?.scrollIntoView({ block: "nearest" });

export function MapToolbar() {
  const fitMap = useFitMap();
  const openGuild = usePanel((state) => state.openGuild);
  const openPlayer = usePanel((state) => state.openPlayer);
  const openFaction = usePanel((state) => state.openFaction);
  const showAll = useMapView((state) => state.showAll);
  const setShowAll = useMapView((state) => state.setShowAll);
  const filter = useMapView((state) => state.filter);
  const selected = useSelection((state) => state.selected);
  const {
    query,
    matches,
    activeIndex,
    activeIsland,
    setActiveIndex,
    changeQuery,
    pick,
    onKeyDown,
  } = useIslandSearch();
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
          role="combobox"
          aria-label="Tìm đảo"
          aria-expanded={matches.length > 0}
          aria-controls="island-search-results"
          aria-activedescendant={
            activeIsland ? `island-option-${activeIsland.id}` : undefined
          }
          placeholder="Tìm số đảo hoặc tên…"
          value={query}
          onChange={(event) => changeQuery(event.target.value)}
          onKeyDown={onKeyDown}
        />
        {matches.length > 0 && (
          <div
            id="island-search-results"
            role="listbox"
            className={styles.searchResults}
          >
            {matches.map((island, index) => (
              <button
                key={island.id}
                id={`island-option-${island.id}`}
                role="option"
                aria-selected={index === activeIndex}
                tabIndex={-1}
                className={index === activeIndex ? styles.active : undefined}
                ref={index === activeIndex ? scrollIntoViewRef : undefined}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => pick(island.id)}
              >
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
