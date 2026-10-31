// Translate domain data to React Flow models without rendering components.
import type { Edge } from "@xyflow/react";
import type {
  AppNode,
  Faction,
  FactionScore,
  Island,
  LayoutNode,
  MapFilter,
  Route,
} from "../types";

// Icon box size (px) per node variant — single source of truth; IslandNode
// consumes it via the inline --icon-box CSS variable and centers the icon on
// the node position, so edges anchored at node centers hit the icon centers.
export function iconBoxSize(
  node: Pick<LayoutNode, "base" | "central">
): number {
  return node.base ? 66 : node.central ? 68 : 55;
}

export interface MapGraphState {
  selected: string | null;
  pinned: Set<string>;
  showAll: boolean;
  // Node ids được filter guild/player highlight; null = all (không dim gì).
  matched: Set<string> | null;
  debug?: boolean;
  playerHighlight?: {
    faction: string;
    scoresByNode: Map<string, number>;
  };
}

export interface MapGraphActions {
  openIsland: (id: string) => void;
  togglePin: (id: string) => void;
}

// Filter guild/player → tập node được highlight (node có đóng góp của
// guild/player đó). Trả null khi không filter; guild/player lạ → tập rỗng.
export function matchNodeIds(
  filter: MapFilter | null,
  nodeIdsByGuild: Map<string, Set<string>>,
  nodeIdsByPlayer: Map<string, Set<string>>
): Set<string> | null {
  if (!filter) return null;
  const index = filter.kind === "guild" ? nodeIdsByGuild : nodeIdsByPlayer;
  return index.get(filter.id) ?? new Set();
}

export function buildMapNodes(
  islands: Island[],
  scoresByNode: Map<string, FactionScore[]>,
  factions: Faction[],
  state: MapGraphState,
  actions: MapGraphActions
): AppNode[] {
  return islands.map((island) => ({
    id: island.id,
    type: "island" as const,
    position: island.position,
    zIndex:
      state.showAll || state.pinned.has(island.id)
        ? 10
        : island.id === state.selected
          ? 5
          : 1,
    data: {
      ...island,
      factionInfo: factions.find((faction) => faction.id === island.owner),
      scores: scoresByNode.get(island.id),
      pinned: state.pinned.has(island.id),
      showAll: state.showAll,
      active: island.id === state.selected,
      dim: state.matched !== null && !state.matched.has(island.id),
      matched: state.matched?.has(island.id) ?? false,
      debug: state.debug,
      playerHighlight: state.playerHighlight
        ? {
            faction: state.playerHighlight.faction,
            score: state.playerHighlight.scoresByNode.get(island.id) ?? 0,
          }
        : undefined,
      open: actions.openIsland,
      pin: actions.togglePin,
    },
  }));
}

export function buildMapEdges(
  routes: Route[],
  islands: Island[],
  factions: Faction[],
  filterActive = false,
  // Màu + opacity nhóm trung lập (edge không thuộc phe) — chỉnh từ picker debug.
  neutralColor = "#9caeb9",
  neutralOpacity = 0.4
): Edge[] {
  const byId = new Map(islands.map((island) => [island.id, island]));
  // Filter không highlight edge — chỉ dim toàn bộ connection để node được
  // highlight nổi lên.
  return routes.map((route) => {
    const source = byId.get(route.source);
    const target = byId.get(route.target);
    const faction =
      source?.owner && source.owner === target?.owner
        ? factions.find((entry) => entry.id === source.owner)
        : null;
    // Neutral islands answer to no base, so any route touching one draws
    // dashed in every view. Owned edges đậm để nổi trên toàn cảnh; neutral
    // link đứt + nhạt để không rối mắt.
    const neutralLink =
      source && target && (!source.owner || !target.owner) ? "7 7" : undefined;
    return {
      ...route,
      id: `${route.source}__${route.target}`,
      sourceHandle: "out",
      targetHandle: "in",
      type: "route",
      selectable: false,
      style: {
        stroke: faction?.edgeColor ?? faction?.color ?? neutralColor,
        strokeWidth: faction ? 3 : 2,
        opacity: filterActive
          ? faction
            ? 0.2
            : 0.12
          : faction
            ? 0.7
            : neutralOpacity,
        strokeDasharray: neutralLink,
      },
    };
  });
}
