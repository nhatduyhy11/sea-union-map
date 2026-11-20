import { useEffect, useMemo, useState } from "react";
import {
  factionFilterIds,
  type FactionNodeFilter,
} from "../../../domain/selectors";
import { useMapView } from "../../../stores/mapView";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import type { FactionIslandStats } from "../../../domain/selectors/board/types";
import { keepsPoints } from "./components/Plot/thresholdValue";

// Ngưỡng điểm phe trên dot plot: giữ đảo đủ điểm có điểm >= value, hoặc
// <= value khi below. upper khác null = kẹp cạnh bằng vạch thứ hai: giữ đoạn
// giữa hai vạch, hoặc hai phía ngoài khi below. Mặc định 0 / không below /
// không kẹp = không lọc.
export interface ScoreThreshold {
  value: number;
  below: boolean;
  upper: number | null;
}

export const NO_THRESHOLD: ScoreThreshold = {
  value: 0,
  below: false,
  upper: null,
};
const THRESHOLD_DEBOUNCE = 400;

// Filter tập đảo của chi tiết căn cứ: filter trạng thái (dòng bảng / pill) và
// ngưỡng điểm, bật cả hai thì lấy giao. Filter đang bật = highlight các đảo đó
// trên map; rời panel thì gỡ. Filter gắn với phe đã chọn nó: đổi căn cứ thì
// coi như chưa lọc ngay từ render đầu, không highlight tập của phe cũ.
export function useBaseFilter(factionId: string, stats: FactionIslandStats) {
  const [picked, setPicked] = useState<{
    factionId: string;
    filter: FactionNodeFilter | null;
    threshold: ScoreThreshold;
  }>({ factionId, filter: null, threshold: NO_THRESHOLD });
  const own = picked.factionId === factionId;
  const activeFilter = own ? picked.filter : null;
  const threshold = own ? picked.threshold : NO_THRESHOLD;
  const setActiveFilter = (filter: FactionNodeFilter | null) =>
    setPicked({ factionId, filter, threshold });
  const toggleFilter = (filter: FactionNodeFilter) =>
    setActiveFilter(activeFilter === filter ? null : filter);
  const setThreshold = (next: ScoreThreshold) =>
    setPicked({ factionId, filter: activeFilter, threshold: next });

  // Vạch ngưỡng bám chuột ngay, còn tập đảo lọc (mờ chấm, highlight map) chỉ
  // tính lại khi ngừng kéo THRESHOLD_DEBOUNCE ms. Về 0 (bỏ lọc, đổi phe) thì
  // áp ngay để không lọc phe mới bằng ngưỡng cũ.
  const below = threshold.below;
  const settled = useDebouncedValue(threshold.value, THRESHOLD_DEBOUNCE);
  const value = threshold.value === 0 ? 0 : settled;
  const settledUpper = useDebouncedValue(threshold.upper, THRESHOLD_DEBOUNCE);
  const upper = threshold.upper === null ? null : settledUpper;
  const thresholdActive =
    threshold.value > 0 || below || threshold.upper !== null;
  const applied = value > 0 || below || upper !== null;
  const highlight = useMemo(() => {
    const byFilter = activeFilter
      ? factionFilterIds(stats, activeFilter)
      : null;
    if (!applied) return byFilter;
    const kept = new Set(
      stats.enoughIslands
        .filter((island) => keepsPoints(island.points, value, below, upper))
        .map((island) => island.id)
    );
    if (!byFilter) return kept;
    return new Set([...byFilter].filter((id) => kept.has(id)));
  }, [stats, activeFilter, applied, value, below, upper]);

  useEffect(() => {
    const { setNodeHighlight } = useMapView.getState();
    setNodeHighlight(highlight);
    return () => setNodeHighlight(null);
  }, [highlight]);
  return {
    activeFilter,
    setActiveFilter,
    toggleFilter,
    threshold,
    thresholdActive,
    setThreshold,
    highlight,
  };
}
