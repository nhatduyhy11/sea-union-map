// Builds the map graph from the raw traced data in map-coords.ts.
import type { LayoutNode, Position, Route } from "../types";
import { MAP_ORIGIN, bases, center, chains, inner, outer } from "./map-coords";

// Traced pixels are scaled up so nodes have room to breathe on the canvas.
const MAP_SCALE = 2;
const position = (x: number, y: number): Position => ({
  x: (x - MAP_ORIGIN.x) * MAP_SCALE,
  y: (y - MAP_ORIGIN.y) * MAP_SCALE,
});
const indexed = (
  tier: number,
  rows: [number, number, number][]
): LayoutNode[] =>
  rows.map(([index, x, y]) => ({
    id: `${tier}-${index}`,
    position: position(x, y),
    name: `Đảo ${tier}-${index}`,
    tier,
  }));
export const layoutNodes: LayoutNode[] = [
  ...indexed(1, outer),
  ...indexed(2, inner),
  ...center.map(([id, x]) => ({
    id,
    position: position(x, MAP_ORIGIN.y),
    name: `Cứ điểm ${id}`,
    central: true,
    tier: id === "4" ? 4 : 3,
  })),
  ...bases.map(([faction, name, x, y]) => ({
    id: `base-${faction}`,
    name,
    position: position(x, y),
    base: true,
    owner: faction,
  })),
];
const unique = new Map<string, Route & { id: string }>();
for (const chain of chains)
  for (let i = 1; i < chain.length; i++) {
    const source = chain[i - 1],
      target = chain[i],
      id = [source, target].sort().join("__");
    unique.set(id, { id, source, target });
  }
export const layoutRoutes: Route[] = [...unique.values()];
// Panning is clamped to the mapped area, so the canvas never scrolls into
// empty space: extent = node positions ± half a node ± margin.
// HALF_NODE must match .island width/height (140x85) in IslandNode.module.css.
const HALF_NODE = { x: 70, y: 43 };
const MAP_MARGIN = 150;
const xs = layoutNodes.map((node) => node.position.x);
const ys = layoutNodes.map((node) => node.position.y);
export const mapBounds: [[number, number], [number, number]] = [
  [
    Math.min(...xs) - HALF_NODE.x - MAP_MARGIN,
    Math.min(...ys) - HALF_NODE.y - MAP_MARGIN,
  ],
  [
    Math.max(...xs) + HALF_NODE.x + MAP_MARGIN,
    Math.max(...ys) + HALF_NODE.y + MAP_MARGIN,
  ],
];
