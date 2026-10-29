import { Swords, User, X } from "lucide-react";
import { useMapData } from "../../stores/dataset";
import { resetCanvasFilter } from "../../stores/commands";
import { useMapView } from "../../stores/mapView";
import styles from "./FilterChip.module.css";

// Chip filter đang bật, góc trên canvas — ✕ reset về all. Filter chỉ đặt
// được từ BXH; chip là chiều hiển thị duy nhất trên canvas. Guild filter id
// là guildId — chip tra tên hiển thị từ guildNames.
export function FilterChip() {
  const filter = useMapView((state) => state.filter);
  const { guildNames, players } = useMapData();
  if (!filter) return null;
  const label =
    filter.kind === "guild"
      ? (guildNames[filter.id] ?? filter.id)
      : (players.find((player) => player.id === filter.id)?.name ?? filter.id);
  return (
    <div className={styles.chip}>
      {filter.kind === "guild" ? <Swords size={12} /> : <User size={12} />}
      {label}
      <button aria-label="Bỏ lọc" title="Bỏ lọc" onClick={resetCanvasFilter}>
        <X size={12} />
      </button>
    </div>
  );
}
