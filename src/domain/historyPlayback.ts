import { roundDays } from "../data/eventCalendar";
import type { SeaLiveDump } from "../data/sea-live";
import type { MapData } from "./mapData";
import { layoutNodes } from "../data/map-layout";
import { layoutIdOf } from "../data/sea-live/join";

export const HISTORY_DAY_MS = 3000;

export function historyDays(
  round: string,
  today: string,
  has: (day: string) => boolean
) {
  const past = roundDays(round).filter((day) => day <= today);
  return { days: past.filter(has), missing: past.filter((day) => !has(day)) };
}

export function validateHistoryDump(
  dump: SeaLiveDump,
  server: string,
  round: string
) {
  if (dump.server !== server || dump.eventStart !== round)
    throw new Error("Bản lưu không đúng cụm/đợt");
  const ids = Object.values(dump.camp).map(layoutIdOf).filter(Boolean);
  if (
    new Set(ids).size !== ids.length ||
    layoutNodes.some((node) => !node.base && !ids.includes(node.id)) ||
    Object.keys(dump.camp).some((id) => !Object.hasOwn(dump.owner, id))
  )
    throw new Error("Bản lưu thiếu dữ liệu đảo hoặc chủ đảo");
  const bases = Object.entries(dump.camp).filter(([, camp]) => camp.type === 1);
  const mapping = bases.map(
    ([id, camp]) => [dump.owner[id], dump.baseDir[camp.name]] as const
  );
  if (
    mapping.length !== 4 ||
    mapping.some(([id, dir]) => !id || !dir) ||
    new Set(mapping.map(([id]) => id)).size !== 4 ||
    new Set(mapping.map(([, dir]) => dir)).size !== 4
  )
    throw new Error("Bản lưu thiếu ánh xạ 4 căn cứ");
  const known = new Set(mapping.map(([id]) => id));
  if (Object.values(dump.owner).some((owner) => owner && !known.has(owner)))
    throw new Error("Bản lưu có phe không xác định");
  return JSON.stringify([...mapping].sort(([a], [b]) => a - b));
}

// A presentation origin for the first saved day, not an additional historical snapshot.
export function historyOrigin(model: MapData): MapData {
  return {
    ...model,
    ownedIslands: model.ownedIslands.map((node) =>
      node.base ? node : { ...node, owner: null }
    ),
    canvasIconByNode: new Map(
      model.ownedIslands.map((node) => [
        node.id,
        node.base ? "base" : node.central ? "castle" : "anchor",
      ])
    ),
    scoresByNode: new Map(),
    frontlineByNode: new Map(),
    defendNodeIds: new Set(),
    attackerByNode: new Map(),
  };
}

export interface HistoryCue {
  delay: number;
  duration: number;
}

function territoryDepths(from: MapData, to: MapData) {
  const old = new Map(from.ownedIslands.map((node) => [node.id, node]));
  const byId = new Map(to.ownedIslands.map((node) => [node.id, node]));
  const neighbors = new Map<string, string[]>();
  for (const { source, target } of to.routes) {
    neighbors.set(source, [...(neighbors.get(source) ?? []), target]);
    neighbors.set(target, [...(neighbors.get(target) ?? []), source]);
  }
  // Existing territory is already visible. Only new territory consumes wave steps.
  const depth = new Map<string, number>();
  const queue = to.ownedIslands
    .filter(
      (node) =>
        node.owner && (node.base || old.get(node.id)?.owner === node.owner)
    )
    .map((node) => node.id);
  for (const id of queue) depth.set(id, 0);
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    for (const other of neighbors.get(id) ?? []) {
      if (!depth.has(other) && byId.get(other)?.owner === byId.get(id)?.owner) {
        depth.set(other, depth.get(id)! + 1);
        queue.push(other);
      }
    }
  }
  return depth;
}

export function planHistoryGrowth(from: MapData, to: MapData) {
  const depth = territoryDepths(from, to);
  const byId = new Map(to.ownedIslands.map((node) => [node.id, node]));
  const growthStart = 300;
  const growthWindow = 2100;
  const maxDepth = Math.max(1, ...depth.values());
  const step = growthWindow / (maxDepth + 1);
  const dwell = Math.min(160, step * 0.3);
  const nodes = new Map<string, HistoryCue>();
  for (const node of to.ownedIslands) {
    nodes.set(node.id, {
      delay: growthStart + (depth.get(node.id) ?? 1) * step,
      duration: dwell,
    });
  }
  const routes = new Map<string, HistoryCue & { reverse: boolean }>();
  for (const route of to.routes) {
    const a = byId.get(route.source),
      b = byId.get(route.target);
    const da = depth.get(route.source) ?? 1,
      db = depth.get(route.target) ?? 1;
    const owned = Boolean(a?.owner && a.owner === b?.owner);
    const start = Math.min(da, db);
    routes.set(
      `${route.source}__${route.target}`,
      owned
        ? {
            delay: growthStart + start * step + (start ? dwell : 0),
            duration: da === db ? dwell : step - (start ? dwell : 0),
            reverse: da > db,
          }
        : {
            delay: growthStart + Math.max(da, db) * step + dwell,
            duration: dwell,
            reverse: da > db,
          }
    );
  }
  return { nodes, routes };
}

// Retreat runs from the lost outer islands back to territory still held by that faction.
export function planHistoryRetreat(from: MapData, to: MapData) {
  const depth = territoryDepths(to, from);
  const next = new Map(to.ownedIslands.map((node) => [node.id, node]));
  const old = new Map(from.ownedIslands.map((node) => [node.id, node]));
  const lost = from.ownedIslands.filter(
    (node) =>
      !node.base && node.owner && next.get(node.id)?.owner !== node.owner
  );
  const maxDepth = Math.max(1, ...lost.map((node) => depth.get(node.id) ?? 1));
  const step = 2100 / (maxDepth + 1);
  const dwell = Math.min(160, step * 0.3);
  const nodes = new Map<string, HistoryCue>(
    lost.map((node) => [
      node.id,
      {
        delay: 300 + (maxDepth - (depth.get(node.id) ?? 1)) * step,
        duration: dwell,
      },
    ])
  );
  const routes = new Map<string, HistoryCue & { reverse: boolean }>();
  for (const route of from.routes) {
    const a = old.get(route.source),
      b = old.get(route.target);
    if (
      !a?.owner ||
      a.owner !== b?.owner ||
      (!nodes.has(route.source) && !nodes.has(route.target))
    )
      continue;
    const da = depth.get(route.source) ?? 1,
      db = depth.get(route.target) ?? 1;
    routes.set(`${route.source}__${route.target}`, {
      delay:
        da === db
          ? Math.max(300, 300 + (maxDepth - da) * step - step / 2)
          : 300 + (maxDepth - Math.max(da, db)) * step + dwell,
      duration: da === db ? step / 2 : step - dwell,
      reverse: da > db,
    });
  }
  return { nodes, routes };
}

// Claim and retreat share the day clock. A captured island keeps its old layer
// until the incoming faction arrives; retreat then propagates toward retained territory.
export function planHistoryTransition(from: MapData, to: MapData) {
  const growth = planHistoryGrowth(from, to);
  const retreat = planHistoryRetreat(from, to);
  const depth = territoryDepths(to, from);
  const next = new Map(to.ownedIslands.map((node) => [node.id, node]));
  const arrivals = new Map<string, number>();
  const lostIds = [...retreat.nodes.keys()].sort(
    (a, b) => (depth.get(b) ?? 1) - (depth.get(a) ?? 1)
  );
  for (const id of lostIds) {
    const cue = retreat.nodes.get(id)!;
    const captured = Boolean(next.get(id)?.owner);
    cue.delay = Math.max(
      cue.delay,
      arrivals.get(id) ?? 0,
      captured ? growth.nodes.get(id)!.delay : 0
    );
    if (!captured) growth.nodes.set(id, { ...cue });
    for (const route of from.routes) {
      const key = `${route.source}__${route.target}`;
      const edge = retreat.routes.get(key);
      if (!edge) continue;
      const inner = edge.reverse ? route.target : route.source;
      const outer = edge.reverse ? route.source : route.target;
      if (outer !== id || (depth.get(outer) ?? 1) === (depth.get(inner) ?? 1))
        continue;
      edge.delay = Math.max(edge.delay, cue.delay + cue.duration);
      arrivals.set(
        inner,
        Math.max(arrivals.get(inner) ?? 0, edge.delay + edge.duration)
      );
    }
  }
  // Cycle-closing edges have no unique inward direction; retract after both endpoints.
  for (const route of from.routes) {
    const edge = retreat.routes.get(`${route.source}__${route.target}`);
    if (
      !edge ||
      (depth.get(route.source) ?? 1) !== (depth.get(route.target) ?? 1)
    )
      continue;
    for (const id of [route.source, route.target]) {
      const cue = retreat.nodes.get(id);
      if (cue) edge.delay = Math.max(edge.delay, cue.delay + cue.duration);
    }
  }
  const cues = [
    ...growth.nodes.values(),
    ...growth.routes.values(),
    ...retreat.nodes.values(),
    ...retreat.routes.values(),
  ];
  const end = Math.max(...cues.map((cue) => cue.delay + cue.duration));
  const scale = Math.min(1, 2600 / end);
  for (const cue of cues) {
    cue.delay *= scale;
    cue.duration *= scale;
  }
  return { growth, retreat };
}
