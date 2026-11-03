import { useEffect, useState } from "react";
import {
  factionFilterIds,
  type FactionNodeFilter,
} from "../../../domain/selectors";
import { useMapView } from "../../../stores/mapView";
import type { FactionIslandStats } from "../../../domain/selectors/board/types";

// Filter tập đảo của chi tiết căn cứ. Filter đang bật = highlight các đảo đó
// trên map; rời panel thì gỡ. Filter gắn với phe đã chọn nó: đổi căn cứ thì
// coi như chưa lọc ngay từ render đầu, không highlight tập của phe cũ.
export function useBaseFilter(factionId: string, stats: FactionIslandStats) {
  const [picked, setPicked] = useState<{
    factionId: string;
    filter: FactionNodeFilter | null;
  }>({ factionId, filter: null });
  const activeFilter = picked.factionId === factionId ? picked.filter : null;
  const setActiveFilter = (filter: FactionNodeFilter | null) =>
    setPicked({ factionId, filter });
  const toggleFilter = (filter: FactionNodeFilter) =>
    setActiveFilter(activeFilter === filter ? null : filter);
  const highlight = activeFilter ? factionFilterIds(stats, activeFilter) : null;
  useEffect(() => {
    const { setNodeHighlight } = useMapView.getState();
    setNodeHighlight(highlight);
    return () => setNodeHighlight(null);
  }, [highlight]);
  return { activeFilter, setActiveFilter, toggleFilter, highlight };
}
