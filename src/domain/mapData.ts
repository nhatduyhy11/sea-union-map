import { islands as demoIslands, routes as demoRoutes, contributions as demoContributions } from "../data/demo";
import { islands as liveIslands, contributions as liveContributions } from "../data/sea-live";
import { factions } from "../data/factions";
import { deriveClaims, deriveConnected, type ClaimState } from "./claims";
import {
  buildFactionBoard,
  buildLeaderboard,
  buildNodeBoard,
  playersFromContributions,
  scoresForNode,
} from "./selectors";
import type { FactionScore, Island } from "../types";

// Nguồn dữ liệu: crawl thật từ sea_crawler (sea-live.json — regenerate bằng
// tools/socket_log/sea_to_ui.py; join JSON → islands/contributions nằm ở
// src/data/sea-live.ts). Đặt false để xem lại dữ liệu demo.
export const LIVE = true;

const islands = LIVE ? liveIslands : demoIslands;
export const contributions = LIVE ? liveContributions : demoContributions;
export const routes = demoRoutes;

export const scoresByNode = new Map<string, FactionScore[]>(
  islands.map((node) => [
    node.id,
    scoresForNode(node.id, contributions, factions),
  ])
);

// Live: owner là truth từ server snapshot (0x72/0x000c) — claim rule chỉ còn
// tính connectivity (phe nào còn nối base tới node qua chuỗi node mình own).
// Demo: owner derive từ claim rule nên demo data không lưu owner.
export const claims: ClaimState = LIVE
  ? liveClaims()
  : deriveClaims(islands, routes, contributions);

function liveClaims(): ClaimState {
  const owners = new Map(
    islands.map((node) => [node.id, node.owner] as const)
  );
  return {
    ownerByNode: owners,
    connectedByNode: deriveConnected(islands, routes, owners),
  };
}

export const ownedIslands: Island[] = LIVE
  ? islands
  : islands.map((node) => ({
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
