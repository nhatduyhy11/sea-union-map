// Translate routes to React Flow edges.
import type { Edge } from "@xyflow/react";
import type { Faction, Island, Route } from "../types";

// Route dẫn đe dọa: độ dài một đoạn màu và khoảng trống giữa hai đoạn.
export const ROUTE_DASH = 16;
export const ROUTE_GAP = ROUTE_DASH * 2;

// Route dẫn đe dọa vào node cần thủ / tranh chấp: một màu (một chiều) hoặc
// hai màu xen kẽ (hai phe đe dọa lẫn nhau).
export interface RouteEdgeData extends Record<string, unknown> {
  dashColors?: [string] | [string, string];
}

export function buildMapEdges(
  routes: Route[],
  islands: Island[],
  factions: Faction[],
  filterActive = false,
  // Màu + opacity nhóm trung lập (edge không thuộc phe) — chỉnh từ picker debug.
  neutralColor = "#9caeb9",
  neutralOpacity = 0.5,
  // nodeId → phe đang đe dọa node cần thủ / tranh chấp.
  attackerByNode: ReadonlyMap<string, string> = new Map()
): Edge<RouteEdgeData>[] {
  const byId = new Map(islands.map((island) => [island.id, island]));
  const factionColor = (id: string | undefined) => {
    const faction = factions.find((entry) => entry.id === id);
    return faction ? (faction.edgeColor ?? faction.color) : undefined;
  };
  // Filter không highlight edge — chỉ dim toàn bộ connection để node được
  // highlight nổi lên.
  return routes.map((route) => {
    const source = byId.get(route.source);
    const target = byId.get(route.target);
    const faction =
      source?.owner && source.owner === target?.owner
        ? factions.find((entry) => entry.id === source.owner)
        : null;
    const id = `${route.source}__${route.target}`;
    const base = {
      ...route,
      id,
      sourceHandle: "out",
      targetHandle: "in",
      type: "route",
      selectable: false,
    };

    // Một đầu chỉ tính bị đe dọa qua route này khi đầu kia do chính phe đe
    // dọa own — route nội phe không vẽ. Một chiều: màu phe đe dọa xen
    // neutral. Hai phe đe dọa lẫn nhau: màu phe đe dọa của mỗi đầu.
    const threatVia = (end: string, other: Island | undefined) => {
      const attacker = attackerByNode.get(end);
      return attacker && attacker === other?.owner
        ? factionColor(attacker)
        : undefined;
    };
    const sourceAttacker = threatVia(route.source, target);
    const targetAttacker = threatVia(route.target, source);
    if (sourceAttacker || targetAttacker) {
      const dashColors: [string] | [string, string] =
        sourceAttacker && targetAttacker && sourceAttacker !== targetAttacker
          ? [sourceAttacker, targetAttacker]
          : [(sourceAttacker ?? targetAttacker)!];
      // Một màu: đoạn màu – trống. Hai màu: màu 1 – trống – màu 2 – trống;
      // path này chỉ vẽ màu 1, RouteEdge vẽ màu 2 lệch nửa chu kỳ.
      const gap =
        dashColors.length === 2 ? ROUTE_DASH + ROUTE_GAP * 2 : ROUTE_GAP;
      return {
        ...base,
        data: { dashColors },
        style: {
          stroke: dashColors[0],
          strokeWidth: 8,
          opacity: filterActive ? 0.1 : 0.8,
          strokeDasharray: `${ROUTE_DASH} ${gap}`,
        },
      };
    }

    // Edge không thuộc cùng một phe dùng nét đứt, kể cả nối hai phe khác nhau.
    const neutralLink = faction ? undefined : `${ROUTE_DASH} ${ROUTE_DASH}`;
    return {
      ...base,
      style: {
        stroke: faction?.edgeColor ?? faction?.color ?? neutralColor,
        strokeWidth: faction ? 8 : 6,
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
