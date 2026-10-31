import { buildLiveData, type SeaLiveDump } from "../data/sea-live";
import { factions } from "../data/factions";
import {
  buildFactionBoard,
  buildNodeBoard,
  buildServerLeaderboard,
  NO_GUILD,
  playersFromContributions,
  scoresForNode,
} from "./selectors";
import type { Contribution, FactionScore, Island, Route } from "../types";

// Model UI derive từ một dump (live hoặc snapshot lịch sử của một cụm) — store
// dataset giữ bản đang xem, component đọc qua useMapData(). Join JSON →
// islands/contributions nằm ở src/data/sea-live/join.ts.
export type MapData = ReturnType<typeof buildMapData>;

// Index node ↔ guild/player cho filter canvas: node nào có đóng góp của
// guild/player nào. Guild key là guildId từ game (định danh unique sẵn — hai
// guild cùng tên vẫn tách biệt). Player không guildId, hoặc guildId không có
// row server, rơi bucket NO_GUILD — cùng rule strays buildFactionBoard.
function indexNodeIds(
  map: Map<string, Set<string>>,
  key: string,
  nodeId: string
) {
  const ids = map.get(key);
  if (ids) ids.add(nodeId);
  else map.set(key, new Set([nodeId]));
}

export function buildMapData(dump: SeaLiveDump) {
  const live = buildLiveData(dump);
  const islands: Island[] = live.islands;
  const contributions: Contribution[] = live.contributions;
  const routes: Route[] = live.routes;

  const scoresByNode = new Map<string, FactionScore[]>(
    islands.map((node) => [
      node.id,
      scoresForNode(node, contributions, factions),
    ])
  );

  const knownGuildIds = new Set(
    Object.values(live.factionGuilds).flatMap((rows) =>
      rows.map((row) => row.guildId)
    )
  );
  const nodeIdsByGuild = new Map<string, Set<string>>();
  const nodeIdsByPlayer = new Map<string, Set<string>>();
  for (const entry of contributions) {
    indexNodeIds(nodeIdsByPlayer, entry.playerId, entry.nodeId);
    indexNodeIds(
      nodeIdsByGuild,
      entry.guildId && knownGuildIds.has(entry.guildId)
        ? entry.guildId
        : NO_GUILD,
      entry.nodeId
    );
  }

  return {
    contributions,
    routes,
    scoresByNode,
    ownedIslands: islands,
    // Tab Cá nhân: BXH điểm server (dump playerBoard) — thứ tự/điểm truth.
    // Tab Phe: gắn guild scores server (dump factionGuilds).
    leaderboard: buildServerLeaderboard(
      live.playerBoard,
      contributions,
      factions
    ),
    factionBoard: buildFactionBoard(
      contributions,
      factions,
      islands,
      live.factionGuilds,
      undefined,
      live.fuel
    ),
    nodeBoard: buildNodeBoard(islands, contributions, factions),
    baseCount: islands.filter((node) => node.base).length,
    // Player universe một lần để tra tên (chip filter) — guild của player lấy
    // theo dòng đầu thắng (cùng rule playersFromContributions/buildFactionBoard).
    players: playersFromContributions(contributions),
    // guildId → tên — tra display name cho chip filter guild.
    guildNames: live.guildNames,
    nodeIdsByGuild,
    nodeIdsByPlayer,
  };
}
