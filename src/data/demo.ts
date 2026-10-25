// Boss and contributions are demo data, separate from screenshot layout.
// Ownership is not stored here: it derives from the contributions via the
// claim rule (domain/claims.ts), so the numbers below shape the map.
import { layoutNodes, layoutRoutes } from "./map-layout";
import { factions } from "./factions";
import type { Contribution, Island, Player, Route } from "../types";

const playerNames = [
  "Mây",
  "Akira",
  "Kaito",
  "Sanji",
  "Luffy",
  "Nami",
  "Zoro",
  "Robin",
  "Ace",
  "Law",
  "Sabo",
  "Jinbe",
];
// Two guilds per faction (2+1 members) so the faction board has a
// non-trivial guild ranking to show.
const guildsByFaction = [
  ["Mũ Rơm", "Xương Hải"],
  ["Bạo Quốc", "Kim Cương"],
  ["Mặt Trời", "Hỏa Long"],
  ["Sư Trắng", "Sương Mù"],
];
export const players: Player[] = playerNames.map((name, index) => ({
  id: `p${index}`,
  name,
  faction: factions[index % 4].id,
  guild: guildsByFaction[index % 4]?.[Math.floor(index / 4) % 2],
}));
export const islands: Island[] = layoutNodes.map((node, index) => ({
  ...node,
  owner: node.base ? (node.owner ?? null) : null,
  boss: node.base
    ? null
    : (["Vệ binh biển", "Thuyền trưởng", "Hải vương"][index % 3] ?? null),
  level: node.central ? 100 : node.tier === 1 ? 35 : 60,
  // The real game varies this per node; the demo equalizes it.
  claimThreshold: 1,
}));
export const routes: Route[] = layoutRoutes;

// Contributions replay a progressive claim: the bases expand in lockstep and
// each reached node joins a faction by priority — one that would otherwise
// lose its whole frontier this round, else the one with the least land, else
// a per-(node, faction) coin flip. The derived ownership reads as four
// connected homelands, nodes beyond the spread stay a no-man's middle, and
// the owner's wide margin keeps the borders where they grew.
const MAX_SPREAD = 5;
const SALT = 3;
const HOME = 60;
const REST = 1;
const neighbors = new Map<string, string[]>();
const link = (from: string, to: string) => {
  const list = neighbors.get(from);
  if (list) list.push(to);
  else neighbors.set(from, [to]);
};
for (const { source, target } of routes) {
  link(source, target);
  link(target, source);
}
const coin = (faction: string, node: string) => {
  let hash = (2166136261 ^ SALT) >>> 0;
  const seed = `${node}:${faction}`;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};
const claimBy = new Map<string, string>();
const touchedBy = new Map<string, Set<string>>();
const land = new Map<string, number>(
  factions.map((faction) => [faction.id, 0])
);
let arms = islands
  .filter((node) => node.base && node.owner)
  .map((node) => ({
    faction: node.owner as string,
    frontier: new Set([node.id]),
  }));
for (const arm of arms) {
  claimBy.set([...arm.frontier][0] as string, arm.faction);
  land.set(arm.faction, 1);
}
for (let depth = 0; depth < MAX_SPREAD; depth++) {
  const candidates = new Map<string, Set<string>>();
  for (const arm of arms) {
    const set = new Set<string>();
    for (const id of arm.frontier)
      for (const next of neighbors.get(id) ?? [])
        if (!claimBy.has(next)) {
          set.add(next);
          // Every probed node remembers the arm, so factions only carry
          // score where they actually pushed a link.
          const probed = touchedBy.get(next);
          if (probed) probed.add(arm.faction);
          else touchedBy.set(next, new Set([arm.faction]));
        }
    if (set.size) candidates.set(arm.faction, set);
  }
  const contenders = new Map<string, string[]>();
  for (const [faction, set] of candidates)
    for (const node of set) {
      const list = contenders.get(node);
      if (list) list.push(faction);
      else contenders.set(node, [faction]);
    }
  // An arm whose every candidate is contested would die on a lost coin.
  const starving = new Set(
    [...candidates.entries()]
      .filter(([, set]) => [...set].every((n) => contenders.get(n)!.length > 1))
      .map(([faction]) => faction)
  );
  const roundWins = new Map<string, string>();
  const wonThisRound = new Map<string, number>();
  const rank = (faction: string, node: string) => [
    starving.has(faction) ? 0 : 1,
    land.get(faction)! + (wonThisRound.get(faction) ?? 0),
    coin(faction, node),
  ];
  for (const [node, list] of contenders) {
    const best = list.reduce((a, b) => {
      const [sa, ca, fa] = rank(a, node);
      const [sb, cb, fb] = rank(b, node);
      return sa !== sb
        ? sa < sb
          ? a
          : b
        : ca !== cb
          ? ca < cb
            ? a
            : b
          : fa !== fb
            ? fa < fb
              ? a
              : b
            : a;
    });
    roundWins.set(node, best);
    wonThisRound.set(best, (wonThisRound.get(best) ?? 0) + 1);
  }
  for (const [node, faction] of roundWins) {
    claimBy.set(node, faction);
    land.set(faction, land.get(faction)! + 1);
  }
  arms = arms.map((arm) => ({
    faction: arm.faction,
    frontier: new Set(
      [...roundWins].filter(([, f]) => f === arm.faction).map(([node]) => node)
    ),
  }));
}
const weightsByNode = new Map(
  islands
    .filter((node) => !node.base)
    .map((node) => {
      const owner = claimBy.get(node.id);
      const probed = touchedBy.get(node.id);
      return [
        node.id,
        new Map(
          factions.map((faction) => [
            faction.id,
            owner
              ? faction.id === owner
                ? HOME
                : probed?.has(faction.id)
                  ? REST
                  : 0
              : 0,
          ])
        ),
      ];
    })
);
export const contributions: Contribution[] = islands
  .filter((node) => !node.base)
  .flatMap((node, index) =>
    players
      .map((player, p) => ({
        nodeId: node.id,
        playerId: player.id,
        faction: player.faction,
        score:
          (((index * 17 + p * 11) % 9) + 1) *
          1250 *
          (weightsByNode.get(node.id)?.get(player.faction) ?? 0),
      }))
      .filter((entry) => entry.score > 0)
  );
