// Cross-slice commands — tương tác người dùng chạm nhiều store cùng lúc.
// Gọi qua getState() để là hàm thuần (tham chiếu ổn, dùng được trong useMemo
// mà không cần thêm vào dependency).
import { useMapView } from "./mapView";
import { usePanel } from "./panel";
import { useSelection } from "./selection";
import type { MapFilter } from "../types";

// Mở đảo từ canvas: bật chi tiết + kéo panel về tab cứ điểm.
export function openIsland(id: string) {
  useSelection.getState().open(id);
  usePanel.getState().setTab("node");
}

// Filter guild/player của canvas — nguồn chân lý là BXH (accordion đang mở),
// command ở đây để chip ✕ và các nhịp reset view về sau dùng chung tham chiếu.
export function setCanvasFilter(filter: MapFilter | null) {
  useMapView.getState().setFilter(filter);
}

export function toggleCanvasFilter(filter: MapFilter) {
  useMapView.getState().toggleFilter(filter);
}

export function resetCanvasFilter() {
  useMapView.getState().resetFilter();
}
