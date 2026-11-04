// Translate routes to React Flow edges.
import type { Edge } from "@xyflow/react";
import type { Faction, Island, Route } from "../types";

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
