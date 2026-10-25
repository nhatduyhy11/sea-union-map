import { useCallback } from "react";
import { useReactFlow, type Edge } from "@xyflow/react";
import type { AppNode } from "../types";

// Single source of truth for how the map frames itself — shared by the
// initial <ReactFlow fitViewOptions> and manual re-fit.
export const FIT_VIEW_OPTIONS = { padding: 0.15, duration: 500 } as const;

// Fit toàn cảnh — consumed directly by the fixed set of components with a fit
// button (NavigationRail, MapToolbar), not routed through any store.
export function useFitMap() {
  const { fitView } = useReactFlow<AppNode, Edge>();
  return useCallback(() => fitView(FIT_VIEW_OPTIONS), [fitView]);
}
