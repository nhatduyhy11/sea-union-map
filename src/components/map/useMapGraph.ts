import { useMemo } from "react";
import { factions } from "../../data/factions";
import { buildMapEdges } from "../../domain/buildMapEdges";
import { buildMapNodes, matchNodeIds } from "../../domain/buildMapNodes";
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
  const nodeHighlight = useMapView((state) => state.nodeHighlight);
  const debug = useDebug((state) => state.debug);
  const neutralColor = useDebug((state) => state.neutralColor);
  const neutralOpacity = useDebug((state) => state.neutralOpacity);
  const {
    nodeIdsByGuild,
    nodeIdsByPlayer,
    ownedIslands,
    routes,
    scoresByNode,
    frontlineByNode,
    defendNodeIds,
    canvasIconByNode,
    contributions,
    players,
    leaderboard,
  } = useMapData();

  // Node ids được highlight — dim phần còn lại. Highlight trực tiếp (chi
  // tiết căn cứ) thắng filter guild/player.
  const matched = useMemo(
    () =>
      nodeHighlight
        ? new Set(nodeHighlight)
        : matchNodeIds(filter, nodeIdsByGuild, nodeIdsByPlayer),
    [nodeHighlight, filter, nodeIdsByGuild, nodeIdsByPlayer]
  );
  // Highlight đóng góp của player trên từng đảo khi đang filter theo player.
  const playerHighlight = useMemo(() => {
    if (filter?.kind !== "player") return undefined;
    const player =
      players.find((p) => p.id === filter.id) ??
      leaderboard.find((r) => r.id === filter.id);
    if (!player) return undefined;

    const scoresMap = new Map<string, number>();
    for (const c of contributions) {
      if (c.playerId === filter.id) {
        scoresMap.set(c.nodeId, (scoresMap.get(c.nodeId) ?? 0) + c.score);
      }
    }
    return {
      faction: player.faction,
      scoresByNode: scoresMap,
    };
  }, [filter, players, leaderboard, contributions]);
  const nodes = useMemo(
    () =>
      buildMapNodes(
        ownedIslands,
        scoresByNode,
        frontlineByNode,
        defendNodeIds,
        factions,
        { selected, pinned, showAll, matched, debug, playerHighlight },
        { openIsland, togglePin },
        canvasIconByNode
      ),
    [
      ownedIslands,
      scoresByNode,
      frontlineByNode,
      defendNodeIds,
      canvasIconByNode,
      selected,
      pinned,
      showAll,
      matched,
      debug,
      playerHighlight,
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
        // Edge neutral đậm hơn node: opacity mặc định 0.55 → 0.6875.
        Math.min(1, neutralOpacity * 1.25)
      ),
    [routes, ownedIslands, matched, neutralColor, neutralOpacity]
  );
  return { nodes, edges };
}
