import { useCallback } from "react";
import { useReactFlow, type Edge } from "@xyflow/react";
import { currentMapData } from "../stores/dataset";
import { setPanelTab } from "../stores/commands";
import { usePanel } from "../stores/panel";
import { useSelection } from "../stores/selection";
import type { AppNode } from "../types";

const FOCUS_OPTIONS = { zoom: 1, duration: 500 } as const;

// Focus một đảo: mở chi tiết, dời camera tới, kéo panel về tab cứ điểm và
// dọn ô tìm kiếm. Cần instance ReactFlow (setCenter) nên là hook — phần
// state thuần nằm ở stores, command ở đây chỉ compose. Đi khỏi ranking
// (nếu đang ở đó) qua setPanelTab cũng reset view BXH.
export function useFocusIsland() {
  const { setCenter } = useReactFlow<AppNode, Edge>();
  return useCallback(
    (id: string) => {
      const island = currentMapData().ownedIslands.find(
        (node) => node.id === id
      );
      if (!island) return;
      useSelection.getState().open(id);
      setPanelTab("node");
      usePanel.getState().setQuery("");
      setCenter(island.position.x, island.position.y, FOCUS_OPTIONS);
    },
    [setCenter]
  );
}

// Focus đảo từ bảng BXH (tab Cứ điểm): camera pan + đảo thành selected,
// panel giữ nguyên ở bảng — không nhảy sang tab chi tiết. Chỉ gọi khi
// toggle MỞ row (đóng không focus).
export function useFocusIslandOnBoard() {
  const { setCenter } = useReactFlow<AppNode, Edge>();
  return useCallback(
    (id: string) => {
      const island = currentMapData().ownedIslands.find(
        (node) => node.id === id
      );
      if (!island) return;
      useSelection.getState().open(id);
      setCenter(island.position.x, island.position.y, FOCUS_OPTIONS);
    },
    [setCenter]
  );
}
