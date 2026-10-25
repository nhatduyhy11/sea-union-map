import { useCallback } from "react";
import { useReactFlow, type Edge } from "@xyflow/react";
import { ownedIslands } from "../domain/mapData";
import { usePanel } from "../stores/panel";
import { useSelection } from "../stores/selection";
import type { AppNode } from "../types";

const FOCUS_OPTIONS = { zoom: 1, duration: 500 } as const;

// Focus một đảo: mở chi tiết, dời camera tới, kéo panel về tab cứ điểm và
// dọn ô tìm kiếm. Cần instance ReactFlow (setCenter) nên là hook — phần
// state thuần nằm ở stores, command ở đây chỉ compose.
export function useFocusIsland() {
  const { setCenter } = useReactFlow<AppNode, Edge>();
  return useCallback(
    (id: string) => {
      const island = ownedIslands.find((node) => node.id === id);
      if (!island) return;
      useSelection.getState().open(id);
      usePanel.getState().setTab("node");
      usePanel.getState().setQuery("");
      setCenter(island.position.x, island.position.y, FOCUS_OPTIONS);
    },
    [setCenter]
  );
}
