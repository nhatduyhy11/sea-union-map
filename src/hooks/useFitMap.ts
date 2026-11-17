import { useCallback, useEffect, useRef, useState } from "react";
import {
  getNodesBounds,
  getViewportForBounds,
  useReactFlow,
  useStore,
  useStoreApi,
  type Edge,
} from "@xyflow/react";
import type { AppNode } from "../types";

// Single source of truth for how the map frames itself — shared by the
// initial <ReactFlow fitViewOptions> and manual re-fit. duration: 0 = fit
// tức thì, không animation zoom khi vừa mount. Padding theo trục: trên/dưới
// thoáng hơn hai bên. Số = tỉ lệ khung (mỗi bên (1 - 1/(1+p))/2): y 0.75 cũ
// ăn ~43% chiều cao, trước đây bị sàn minZoom 0.19 che nên không lộ.
export const FIT_VIEW_OPTIONS = {
  padding: { y: 0.15, x: 0.05 },
  duration: 0,
} as const;

// Mức zoom mà fitView sẽ ra với canvas hiện tại (cùng padding FIT_VIEW_OPTIONS),
// tính lại mỗi khi canvas đổi kích thước hoặc node được đo xong. Dùng làm sàn
// minZoom; khi sàn tăng lên trên zoom đang hiển thị (phóng to cửa sổ lúc đang
// zoom-out hết cỡ) thì fit lại ngay, không chờ người dùng cuộn. null khi canvas
// chưa có kích thước / node chưa đo — caller tự chọn giá trị dự phòng.
export function useFitZoom(): number | null {
  const store = useStoreApi<AppNode, Edge>();
  const { fitView } = useReactFlow<AppNode, Edge>();
  const fitZoom = useStore((state) => {
    const { width, height, nodeLookup } = state;
    if (!width || !height || nodeLookup.size === 0) return null;
    const nodes = [...nodeLookup.values()];
    if (nodes.some((node) => !node.measured.width)) return null;
    const bounds = getNodesBounds(nodes, { nodeLookup });
    return getViewportForBounds(
      bounds,
      width,
      height,
      0,
      Infinity,
      FIT_VIEW_OPTIONS.padding
    ).zoom;
  });
  useEffect(() => {
    if (fitZoom === null) return;
    const currentZoom = store.getState().transform[2];
    if (currentZoom < fitZoom - 1e-4) fitView(FIT_VIEW_OPTIONS);
  }, [fitZoom, store, fitView]);
  return fitZoom;
}

// Màn hẹp (khớp breakpoint mobile của MapCanvas): canvas vuông, map ngang fit
// theo bề rộng nên ở mức fit = sàn minZoom map bị translateExtent khóa cứng,
// kéo không đi đâu. Lần đầu có fitZoom thì mở sẵn ở mức zoom gấp
// MOBILE_ZOOM_FACTOR quanh tâm map để vào là kéo được ngay; nút fit vẫn về
// toàn cảnh như cũ. Prop fitView của <ReactFlow> chạy sau effect này và đè
// mất mức zoom, nên trên mobile hook tự fit và trả false để tắt prop đó.
const MOBILE_QUERY = "(max-width: 760px)";
const MOBILE_ZOOM_FACTOR = 2;
// Trần zoom: 100% trên mobile (đủ đọc nhãn/popup trên màn nhỏ) — zoom 200% ở
// màn 3x bắt WebKit rasterize world map gấp đôi mỗi chiều, dễ hết bộ nhớ tab.
const MAX_ZOOM = 2;
const MOBILE_MAX_ZOOM = 1;

export function useInitialFraming(fitZoom: number | null): {
  autoFit: boolean;
  maxZoom: number;
} {
  const { fitView, zoomTo } = useReactFlow<AppNode, Edge>();
  const [mobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  const done = useRef(false);
  useEffect(() => {
    if (!mobile || done.current || fitZoom === null) return;
    done.current = true;
    void fitView(FIT_VIEW_OPTIONS).then(() =>
      zoomTo(fitZoom * MOBILE_ZOOM_FACTOR, { duration: 0 })
    );
  }, [mobile, fitZoom, fitView, zoomTo]);
  return { autoFit: !mobile, maxZoom: mobile ? MOBILE_MAX_ZOOM : MAX_ZOOM };
}

// Fit toàn cảnh — consumed directly by the components that re-frame the map
// (nút fit của NavigationRail / MapToolbar, đổi phe ở BaseCarousel), not
// routed through any store. `duration` > 0 = zoom ra mượt thay vì nhảy khung.
export function useFitMap(duration: number = FIT_VIEW_OPTIONS.duration) {
  const { fitView } = useReactFlow<AppNode, Edge>();
  return useCallback(
    () => fitView({ ...FIT_VIEW_OPTIONS, duration }),
    [fitView, duration]
  );
}
