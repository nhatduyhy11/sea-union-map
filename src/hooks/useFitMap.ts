import { useCallback } from "react";
import { useReactFlow, type Edge } from "@xyflow/react";
import type { AppNode } from "../types";

// Single source of truth for how the map frames itself — shared by the
// initial <ReactFlow fitViewOptions> and manual re-fit. duration: 0 = fit
// tức thì, không animation zoom khi vừa mount. Padding theo trục: đứng/dưới
// thoáng (0.75), hai bên hẹp (0.125).
export const FIT_VIEW_OPTIONS = {
  padding: { y: 0.75, x: 0.125 },
  duration: 0,
} as const;

// Fit toàn cảnh — consumed directly by the fixed set of components with a fit
// button (NavigationRail, MapToolbar), not routed through any store.
export function useFitMap() {
  const { fitView } = useReactFlow<AppNode, Edge>();
  return useCallback(() => fitView(FIT_VIEW_OPTIONS), [fitView]);
}
