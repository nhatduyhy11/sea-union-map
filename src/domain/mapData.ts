import { islands, routes, contributions, players } from "../data/demo";
import { factions } from "../data/factions";
import { deriveClaims } from "./claims";
import {
  buildFactionBoard,
  buildLeaderboard,
  buildNodeBoard,
  scoresForNode,
} from "./selectors";
import type { FactionScore, Island } from "../types";

export const scoresByNode = new Map<string, FactionScore[]>(
  islands.map((node) => [
    node.id,
    scoresForNode(node.id, contributions, factions),
  ])
);
// Owner comes from the claim rule, so the demo data never stores it for
// non-base nodes; the map panels all read these islands instead.
export const claims = deriveClaims(islands, routes, contributions);
export const ownedIslands: Island[] = islands.map((node) => ({
  ...node,
  owner: claims.ownerByNode.get(node.id) ?? null,
}));
export const leaderboard = buildLeaderboard(players, contributions, factions);
export const factionBoard = buildFactionBoard(
  players,
  contributions,
  factions,
  ownedIslands
);
export const nodeBoard = buildNodeBoard(islands, contributions, factions);
export const baseCount = islands.filter((node) => node.base).length;
