// Translate island data to React Flow nodes.
import type {
  AppNode,
  Faction,
  FactionScore,
  Island,
  LayoutNode,
} from "../types";
import type { CanvasIcon } from "./selectors/canvasIcons";

// Filter canvas theo guild/player — null = all.
// Guild dùng guildId từ game làm identity; bucket "Không guild" giữ nguyên
// chuỗi "Không guild".
export interface MapFilter {
  kind: "guild" | "player";
  id: string;
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

// Icon box size (px) per node variant — single source of truth; IslandNode
// consumes it via the inline --icon-box CSS variable and centers the icon on
// the node position, so edges anchored at node centers hit the icon centers.
// The map center (tier 4) shows its island artwork instead of the diamond,
// sized to fill the gap between the 3-1/3-2 guardian illustrations. Its CSS
// centering offset is a % of this size, so retune it when this changes.
const CENTER_ICON_BOX = 240;
export function iconBoxSize(
  node: Pick<LayoutNode, "base" | "central" | "tier">
): number {
  if (node.tier === 4) return CENTER_ICON_BOX;
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
