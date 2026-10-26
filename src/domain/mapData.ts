import { islands, routes, contributions } from "../data/demo";
import { factions } from "../data/factions";
import { deriveClaims } from "./claims";
import {
  buildFactionBoard,
  buildLeaderboard,
  buildNodeBoard,
  playersFromContributions,
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
export const leaderboard = buildLeaderboard(contributions, factions);
export const factionBoard = buildFactionBoard(
  contributions,
  factions,
  ownedIslands
);
export const nodeBoard = buildNodeBoard(islands, contributions, factions);
export const baseCount = islands.filter((node) => node.base).length;

// Player universe một lần để tra tên (chip filter) — guild của player lấy
// theo dòng đầu thắng (cùng rule playersFromContributions/buildFactionBoard).
export const players = playersFromContributions(contributions);

// Index node ↔ guild/player cho filter canvas: node nào có đóng góp của
// guild/player nào. Bucket "Không guild" gộp mọi player không guild, khớp
// cách bucket ở BXH Phe.
function indexNodeIds(
  map: Map<string, Set<string>>,
  key: string,
  nodeId: string
) {
  const ids = map.get(key);
  if (ids) ids.add(nodeId);
  else map.set(key, new Set([nodeId]));
}

export const nodeIdsByGuild = new Map<string, Set<string>>();
export const nodeIdsByPlayer = new Map<string, Set<string>>();
const guildByPlayer = new Map(
  players.map((player) => [player.id, player.guild ?? "Không guild"])
);
for (const entry of contributions) {
  indexNodeIds(nodeIdsByPlayer, entry.playerId, entry.nodeId);
  indexNodeIds(
    nodeIdsByGuild,
    guildByPlayer.get(entry.playerId) ?? "Không guild",
    entry.nodeId
  );
}
