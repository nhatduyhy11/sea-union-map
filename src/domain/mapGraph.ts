// Translate domain data to React Flow models without rendering components.
import type { Edge } from "@xyflow/react";
import type { AppNode } from "../types";
import type { CanvasIcon } from "./selectors/canvasIcons";
import type {
  Faction,
  FactionScore,
  Island,
  LayoutNode,
  Route,
} from "../types";

// Filter canvas theo guild/player — null = all.
// Guild dùng guildId từ game làm identity; bucket "Không guild" giữ nguyên
// chuỗi "Không guild".
export interface MapFilter {
  kind: "guild" | "player";
  id: string;
}

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
  // Node giao tranh (domain/selectors/frontline.ts) — data node mang theo
  // { rival, ratio } để viền hồng, sẵn cho popup/tooltip sau này.
  frontlineByNode: Map<string, { rival: Faction; ratio: number }>,
  // Node cần thủ (canvasIcon "defend") — flag cho icon shield-alert
  // + fill màu phe nhạt.
  defendNodeIds: Set<string>,
  factions: Faction[],
  state: MapGraphState,
  actions: MapGraphActions,
  canvasIconByNode: ReadonlyMap<string, CanvasIcon> = new Map()
): AppNode[] {
  return islands.map((island) => {
    const front = frontlineByNode.get(island.id);
    return {
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
        canvasIcon: canvasIconByNode.get(island.id),
        factionInfo: factions.find((faction) => faction.id === island.owner),
        scores: scoresByNode.get(island.id),
        pinned: state.pinned.has(island.id),
        showAll: state.showAll,
        active: island.id === state.selected,
        dim: state.matched !== null && !state.matched.has(island.id),
        matched: state.matched?.has(island.id) ?? false,
        frontline: front && { rival: front.rival, ratio: front.ratio },
        defend: defendNodeIds.has(island.id),
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
    };
  });
}

export function buildMapEdges(
  routes: Route[],
  islands: Island[],
  factions: Faction[],
  filterActive = false,
  // Màu + opacity nhóm trung lập (edge không thuộc phe) — chỉnh từ picker debug.
  neutralColor = "#9caeb9",
  neutralOpacity = 0.5
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
    // Edge không thuộc cùng một phe dùng nét đứt, kể cả nối hai phe khác nhau.
    const neutralLink = faction ? undefined : "7 7";
    return {
      ...route,
      id: `${route.source}__${route.target}`,
      sourceHandle: "out",
      targetHandle: "in",
      type: "route",
      selectable: false,
      style: {
        stroke: faction?.edgeColor ?? faction?.color ?? neutralColor,
        strokeWidth: faction ? 5 : 3.5,
        opacity: filterActive
          ? faction
            ? 0.1
            : 0.06
          : faction
            ? 0.7
            : neutralOpacity,
        strokeDasharray: neutralLink,
      },
    };
  });
}
