// Claim resolution: a faction's score at a node only counts for that node
// while a chain of the faction's own nodes links its base to it. When the
// chain is cut the score is suspended — excluded from the contest (but never
// lost, so leaderboards still sum raw contributions). Ownership therefore has
// to be derived jointly with connectivity, hence the fixed-point iteration.
import type { Contribution, Island, Route } from "../types";

export interface ClaimState {
  // Derived owner per node id; bases keep their faction, ties stay neutral.
  ownerByNode: Map<string, string | null>;
  // Factions whose score counts at the node, i.e. still connected to base.
  connectedByNode: Map<string, Set<string>>;
}

function buildAdjacency(routes: Route[]): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  const link = (from: string, to: string) => {
    const list = adjacency.get(from);
    if (list) list.push(to);
    else adjacency.set(from, [to]);
  };
  for (const { source, target } of routes) {
    link(source, target);
    link(target, source);
  }
  return adjacency;
}

function reachConnected(
  adjacency: Map<string, string[]>,
  baseOf: Map<string, string>,
  owners: Map<string, string | null>
): Map<string, Set<string>> {
  const connected = new Map<string, Set<string>>();
  for (const [faction, base] of baseOf) {
    const reached = new Set<string>([base]);
    const frontier = [base];
    for (let head = 0; head < frontier.length; head++) {
      for (const next of adjacency.get(frontier[head] as string) ?? []) {
        if (reached.has(next)) continue;
        reached.add(next);
        if (owners.get(next) === faction) frontier.push(next);
      }
    }
    connected.set(faction, reached);
  }
  return connected;
}

// Connectivity for a fixed owner map (live crawl): phe tới được node khi
// chuỗi node phe đó OWN (theo server) nối base tới nó — không chạy contest.
export function deriveConnected(
  islands: Island[],
  routes: Route[],
  owners: Map<string, string | null>
): Map<string, Set<string>> {
  const baseOf = new Map(
    islands
      .filter((node) => node.base && node.owner)
      .map((node) => [node.owner as string, node.id])
  );
  return reachConnected(buildAdjacency(routes), baseOf, owners);
}

export function deriveClaims(
  islands: Island[],
  routes: Route[],
  contributions: Contribution[]
): ClaimState {
  const adjacency = buildAdjacency(routes);
  const byNode = new Map<string, Contribution[]>();
  for (const entry of contributions) {
    const list = byNode.get(entry.nodeId);
    if (list) list.push(entry);
    else byNode.set(entry.nodeId, [entry]);
  }
  const baseOf = new Map(
    islands
      .filter((node) => node.base && node.owner)
      .map((node) => [node.owner as string, node.id])
  );
  let owners = new Map<string, string | null>(
    islands.map((node) => [node.id, node.base ? (node.owner ?? null) : null])
  );

  // Factions reachable from their base, expanding only through own nodes —
  // every entered node counts as connected, owned ones relay further. Returns
  // per-faction sets; the published state inverts them to per-node sets.
  const reach = (owners: Map<string, string | null>) =>
    reachConnected(adjacency, baseOf, owners);
  const byNodeView = (perFaction: Map<string, Set<string>>) => {
    const byNode = new Map(islands.map((node) => [node.id, new Set<string>()]));
    for (const [faction, nodes] of perFaction)
      for (const id of nodes) byNode.get(id)?.add(faction);
    return byNode;
  };
  const contest = (connected: Map<string, Set<string>>) => {
    const next = new Map(owners);
    for (const node of islands) {
      if (node.base) continue;
      const totals = new Map<string, number>();
      for (const entry of byNode.get(node.id) ?? [])
        if (connected.get(entry.faction)?.has(node.id))
          totals.set(
            entry.faction,
            (totals.get(entry.faction) ?? 0) + entry.score
          );
      // Reached threshold wins; an exact tie leaves the node unclaimed.
      let best: string | null = null;
      let bestScore = 0;
      let tied = false;
      for (const [faction, score] of totals) {
        if (score < node.claimThreshold) continue;
        if (score > bestScore) {
          best = faction;
          bestScore = score;
          tied = false;
        } else if (score === bestScore) tied = true;
      }
      next.set(node.id, tied ? null : best);
    }
    return next;
  };
  const same = (a: Map<string, string | null>, b: Map<string, string | null>) =>
    islands.every((node) => a.get(node.id) === b.get(node.id));

  // Claims settle outward from the bases, so a handful of passes suffice;
  // the cap only guards pathological score layouts.
  let connected = reach(owners);
  for (let pass = 0; pass <= islands.length; pass++) {
    const next = contest(connected);
    const stable = same(next, owners);
    owners = next;
    if (stable)
      return { ownerByNode: owners, connectedByNode: byNodeView(connected) };
    connected = reach(owners);
  }
  return {
    ownerByNode: owners,
    connectedByNode: byNodeView(reach(owners)),
  };
}
