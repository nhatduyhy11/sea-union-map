// Cross-slice commands — tương tác người dùng chạm nhiều store cùng lúc.
// Gọi qua getState() để là hàm thuần (tham chiếu ổn, dùng được trong useMemo
// mà không cần thêm vào dependency).
import { useMapView } from "./mapView";
import { usePanel } from "./panel";
import { useSelection } from "./selection";

// Mở đảo từ canvas: bật chi tiết + kéo panel về tab cứ điểm.
export function openIsland(id: string) {
  useSelection.getState().open(id);
  usePanel.getState().setTab("node");
}

// Filter phe ở legend đáy canvas là nguồn chân lý duy nhất: panel ranking
// đọc cùng state nên sub-tab phe ở BXH Phe cũng lọc ngược canvas. Chọn phe
// ở legend đồng thời kéo panel sang ranking, mở đúng tab phe đó.
export function selectFaction(id: string) {
  useMapView.getState().toggleFaction(id);
  usePanel.getState().setTab("ranking");
  usePanel.getState().setBoard("faction");
}
