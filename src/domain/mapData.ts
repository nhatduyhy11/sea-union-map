import {
  islands as liveIslands,
  contributions as liveContributions,
  playerBoard as serverPlayerBoard,
  factionGuilds as serverFactionGuilds,
  guildNames,
  routes as liveRoutes,
} from "../data/sea-live";
import { factions } from "../data/factions";
import { deriveConnected, type ClaimState } from "./claims";
import {
  buildFactionBoard,
  buildNodeBoard,
  buildServerLeaderboard,
  playersFromContributions,
  scoresForNode,
} from "./selectors";
import type { FactionScore } from "../types";

// Nguồn dữ liệu duy nhất: data crawl thật từ JSON dump (sea-live.json —
// regenerate bằng script dump; join JSON → islands/
// contributions nằm ở src/data/sea-live.ts).
const islands = liveIslands;
export const contributions = liveContributions;
export const routes = liveRoutes;

export const scoresByNode = new Map<string, FactionScore[]>(
  islands.map((node) => [
    node.id,
    scoresForNode(node.id, contributions, factions),
  ])
);

// Owner là truth từ server snapshot (dump owner) — claim rule chỉ còn tính
// connectivity (phe nào còn nối base tới node qua chuỗi node mình own).
const ownerByNode = new Map(
  islands.map((node) => [node.id, node.owner] as const)
);
export const claims: ClaimState = {
  ownerByNode,
  connectedByNode: deriveConnected(islands, routes, ownerByNode),
};

export const ownedIslands = islands;

// Tab Cá nhân: BXH điểm server (dump playerBoard) — thứ tự/điểm truth. Tab
// Phe: gắn guild scores server (dump factionGuilds).
export const leaderboard = buildServerLeaderboard(
  serverPlayerBoard,
  contributions,
  factions
);
export const factionBoard = buildFactionBoard(
  contributions,
  factions,
  ownedIslands,
  serverFactionGuilds
);
export const nodeBoard = buildNodeBoard(islands, contributions, factions);
export const baseCount = islands.filter((node) => node.base).length;

// Player universe một lần để tra tên (chip filter) — guild của player lấy
// theo dòng đầu thắng (cùng rule playersFromContributions/buildFactionBoard).
export const players = playersFromContributions(contributions);

// guildId → tên — tra display name cho chip filter guild.
export { guildNames };

// Index node ↔ guild/player cho filter canvas: node nào có đóng góp của
// guild/player nào. Guild key là guildId từ game (định danh unique sẵn — hai
// guild cùng tên vẫn tách biệt). Player không guildId, hoặc guildId không có
// row server, rơi bucket "Không guild" — cùng rule strays buildFactionBoard.
function indexNodeIds(
  map: Map<string, Set<string>>,
  key: string,
  nodeId: string
) {
  const ids = map.get(key);
  if (ids) ids.add(nodeId);
  else map.set(key, new Set([nodeId]));
}

const knownGuildIds = new Set(
  Object.values(serverFactionGuilds).flatMap((rows) =>
    rows.map((row) => row.guildId)
  )
);

export const nodeIdsByGuild = new Map<string, Set<string>>();
export const nodeIdsByPlayer = new Map<string, Set<string>>();
for (const entry of contributions) {
  indexNodeIds(nodeIdsByPlayer, entry.playerId, entry.nodeId);
  indexNodeIds(
    nodeIdsByGuild,
    entry.guildId && knownGuildIds.has(entry.guildId)
      ? entry.guildId
      : "Không guild",
    entry.nodeId
  );
}
