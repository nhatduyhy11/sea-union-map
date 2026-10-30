import { useCallback } from "react";
import { useReactFlow, type Edge } from "@xyflow/react";
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

// Fit toàn cảnh — consumed directly by the fixed set of components with a fit
// button (NavigationRail, MapToolbar), not routed through any store.
export function useFitMap() {
  const { fitView } = useReactFlow<AppNode, Edge>();
  return useCallback(() => fitView(FIT_VIEW_OPTIONS), [fitView]);
}
