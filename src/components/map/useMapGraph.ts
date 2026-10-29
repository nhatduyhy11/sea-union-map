import { useMemo } from "react";
import { factions } from "../../data/factions";
import {
  buildMapEdges,
  buildMapNodes,
  matchNodeIds,
} from "../../domain/mapGraph";
import { openIsland } from "../../stores/commands";
import { useMapData } from "../../stores/dataset";
import { useDebug } from "../../stores/debug";
import { useMapView } from "../../stores/mapView";
import { useSelection } from "../../stores/selection";
import type { Edge } from "@xyflow/react";
import type { AppNode } from "../../types";

// Nodes/edges cho canvas — derived từ mapView (lọc) + debug (màu/overlay) +
// selection (chọn/ghim). Component nào cần graph tự subscribe hook này, thay
// vì App tính rồi truyền xuống.
export function useMapGraph(): { nodes: AppNode[]; edges: Edge[] } {
  const selected = useSelection((state) => state.selected);
  const pinned = useSelection((state) => state.pinned);
  const togglePin = useSelection((state) => state.togglePin);
  const showAll = useMapView((state) => state.showAll);
  const filter = useMapView((state) => state.filter);
  const debug = useDebug((state) => state.debug);
  const neutralColor = useDebug((state) => state.neutralColor);
  const neutralOpacity = useDebug((state) => state.neutralOpacity);
  const {
    nodeIdsByGuild,
    nodeIdsByPlayer,
    ownedIslands,
    routes,
    scoresByNode,
  } = useMapData();

  // Node ids được filter guild/player highlight — dim phần còn lại.
  const matched = useMemo(
    () => matchNodeIds(filter, nodeIdsByGuild, nodeIdsByPlayer),
    [filter, nodeIdsByGuild, nodeIdsByPlayer]
  );
  const nodes = useMemo(
    () =>
      buildMapNodes(
        ownedIslands,
        scoresByNode,
        factions,
        { selected, pinned, showAll, matched, debug },
        { openIsland, togglePin }
      ),
    [
      ownedIslands,
      scoresByNode,
      selected,
      pinned,
      showAll,
      matched,
      debug,
      togglePin,
    ]
  );
  // Edges không highlight theo filter nhưng dim xuống khi có filter (node
  // highlight nổi lên) — recompute theo matched + màu/opacity trung lập.
  const edges = useMemo(
    () =>
      buildMapEdges(
        routes,
        ownedIslands,
        factions,
        matched !== null,
        neutralColor,
        neutralOpacity
      ),
    [routes, ownedIslands, matched, neutralColor, neutralOpacity]
  );
  return { nodes, edges };
}
