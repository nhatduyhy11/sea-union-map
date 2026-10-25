import { useMemo } from "react";
import { routes } from "../data/demo";
import { factions } from "../data/factions";
import { buildMapEdges, buildMapNodes } from "../domain/mapGraph";
import { ownedIslands, scoresByNode } from "../domain/mapData";
import { openIsland } from "../stores/commands";
import { useMapView } from "../stores/mapView";
import { useSelection } from "../stores/selection";
import type { Edge } from "@xyflow/react";
import type { AppNode } from "../types";

// Nodes/edges cho canvas — derived từ mapView (lọc/debug) + selection
// (chọn/ghim). Component nào cần graph tự subscribe hook này, thay vì App
// tính rồi truyền xuống.
export function useMapGraph(): { nodes: AppNode[]; edges: Edge[] } {
  const selected = useSelection((state) => state.selected);
  const pinned = useSelection((state) => state.pinned);
  const togglePin = useSelection((state) => state.togglePin);
  const showAll = useMapView((state) => state.showAll);
  const filter = useMapView((state) => state.filter);
  const debug = useMapView((state) => state.debug);

  const nodes = useMemo(
    () =>
      buildMapNodes(
        ownedIslands,
        scoresByNode,
        factions,
        { selected, pinned, showAll, filter, debug },
        { openIsland, togglePin }
      ),
    [selected, pinned, showAll, filter, debug, togglePin]
  );
  const edges = useMemo(
    () => buildMapEdges(routes, ownedIslands, factions, filter),
    [filter]
  );
  return { nodes, edges };
}
