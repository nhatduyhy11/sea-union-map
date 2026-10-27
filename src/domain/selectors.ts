// Pure queries: no React, UI state, or data source — everything arrives as
// arguments.
import type {
  Contribution,
  Faction,
  FactionBoardEntry,
  FactionScore,
  GuildMember,
  Island,
  LeaderboardPlayer,
  NodeBoardEntry,
  NodeDetailData,
  Player,
  ServerGuildRow,
  ServerPlayerRow,
} from "../types";

export function scoresForNode(
  nodeId: string,
  contributions: Contribution[],
  factions: Faction[]
): FactionScore[] {
  const totals = new Map<string, number>();
  for (const entry of contributions) {
    if (entry.nodeId === nodeId) {
      totals.set(entry.faction, (totals.get(entry.faction) ?? 0) + entry.score);
    }
  }
  return factions.map((faction) => ({
    ...faction,
    score: totals.get(faction.id) ?? 0,
  }));
}

export function playerAllocations(
  playerId: string,
  contributions: Contribution[]
): Contribution[] {
  return contributions
    .filter((entry) => entry.playerId === playerId)
    .sort((a, b) => b.score - a.score);
}

// The player universe is the union of every node leaderboard (top-N per node).
// First row wins on identity — crawl rows of one player describe the same
// person, dedupe only picks who reported it first.
export function playersFromContributions(
  contributions: Contribution[]
): Player[] {
  const seen = new Map<string, Player>();
  for (const { playerId, name, faction, guild, guildId } of contributions)
    if (!seen.has(playerId))
      seen.set(playerId, { id: playerId, name, faction, guild, guildId });
  return [...seen.values()];
}

// Tab Cá nhân live: rows = BXH điểm server (top-200, board 117). Thứ tự và
// điểm giữ nguyên server — chỉ ghép thêm allocations từ node boards cho phần
// expand ("contribute vào đâu"). Player ngoài top-N node nào thì expand rỗng.
export function buildServerLeaderboard(
  rows: ServerPlayerRow[],
  contributions: Contribution[],
  factions: Faction[]
): LeaderboardPlayer[] {
  return rows.map((row) => {
    const allocations = playerAllocations(row.playerId, contributions);
    return {
      id: row.playerId,
      name: row.name,
      faction: row.faction ?? "",
      guild: row.guild,
      factionInfo: row.faction
        ? factions.find((faction) => faction.id === row.faction)
        : undefined,
      score: row.score,
      nodes: allocations.length,
      allocations,
    };
  });
}

// Node board ("Cứ điểm"): non-base islands ranked by the total points poured
// into them, each carrying its per-faction breakdown for the expanded row.
export function buildNodeBoard(
  islands: Island[],
  contributions: Contribution[],
  factions: Faction[]
): NodeBoardEntry[] {
  return islands
    .filter((node) => !node.base)
    .map((island) => {
      const scores = scoresForNode(island.id, contributions, factions);
      return {
        island,
        scores,
        total: scores.reduce((sum, faction) => sum + faction.score, 0),
      };
    })
    .sort((a, b) => b.total - a.total);
}

// Faction board ("BXH Phe"). Live: guild rows + điểm guild là truth server
// (0x72/0x0025 — Tổng quan phe; tổng guild khớp per-faction node-state exact);
// duy nhất member list khi expand guild mới derive từ node boards + briefs.
// Member match qua guildId (brief) — player không brief thì rơi "Không guild".
// Không có server guild data: path cũ tự tính từ contributions.
export function buildFactionBoard(
  contributions: Contribution[],
  factions: Faction[],
  islands: Island[],
  serverGuilds?: Record<string, ServerGuildRow[]>
): FactionBoardEntry[] {
  if (!serverGuilds || Object.keys(serverGuilds).length === 0)
    return buildFactionBoardComputed(contributions, factions, islands);
  return factions
    .map((faction) => {
      const rows = serverGuilds[faction.id] ?? [];
      const members = playersFromContributions(contributions).filter(
        (player) => player.faction === faction.id
      );
      const scoreByPlayer = new Map<string, number>();
      for (const entry of contributions)
        if (entry.faction === faction.id)
          scoreByPlayer.set(
            entry.playerId,
            (scoreByPlayer.get(entry.playerId) ?? 0) + entry.score
          );

      const label = (
        guild: string,
        players: number,
        nodes: Set<string>,
        memberList: GuildMember[],
        score: number
      ): FactionBoardEntry["guilds"][number] => ({
        guild,
        score,
        players,
        nodes: nodes.size,
        members: memberList.sort((a, b) => b.score - a.score),
      });

      const buildBucket = (guildKey: string, bucketMembers: Player[]) => {
        const nodes = new Set<string>();
        const memberList: GuildMember[] = [];
        let score = 0;
        for (const player of bucketMembers) {
          const playerScore = scoreByPlayer.get(player.id) ?? 0;
          const allocations = playerAllocations(player.id, contributions);
          score += playerScore;
          for (const allocation of allocations) nodes.add(allocation.nodeId);
          memberList.push({
            id: player.id,
            name: player.name,
            score: playerScore,
            nodes: allocations.length,
          });
        }
        return {
          guildKey,
          nodes,
          memberList,
          score,
          count: bucketMembers.length,
        };
      };

      const knownIds = new Set(rows.map((row) => row.guildId));
      const guildEntries = rows.map((row) => {
        const bucket = buildBucket(
          row.name,
          members.filter((player) => player.guildId === row.guildId)
        );
        // Điểm guild là server truth — bucket score chỉ dùng cho member list.
        return label(
          row.name,
          bucket.count,
          bucket.nodes,
          bucket.memberList,
          row.score
        );
      });
      const strays = members.filter(
        (player) => !player.guildId || !knownIds.has(player.guildId)
      );
      const guilds = [...guildEntries];
      if (strays.length)
        guilds.push(
          (() => {
            const bucket = buildBucket("Không guild", strays);
            return label(
              "Không guild",
              bucket.count,
              bucket.nodes,
              bucket.memberList,
              bucket.score
            );
          })()
        );
      return {
        ...faction,
        islands: islands.filter((node) => node.owner === faction.id).length,
        guilds,
        score: rows.reduce((total, row) => total + row.score, 0),
      };
    })
    .sort((a, b) => b.score - a.score);
}

// Legacy computed path (demo fixture): guild = bucket theo tên, mọi số tự tính.
function buildFactionBoardComputed(
  contributions: Contribution[],
  factions: Faction[],
  islands: Island[]
): FactionBoardEntry[] {
  const players = playersFromContributions(contributions);
  const scoreByPlayer = new Map<string, number>();
  for (const entry of contributions)
    scoreByPlayer.set(
      entry.playerId,
      (scoreByPlayer.get(entry.playerId) ?? 0) + entry.score
    );
  return factions
    .map((faction) => {
      const members = players.filter((player) => player.faction === faction.id);
      const guilds = new Map<
        string,
        {
          score: number;
          players: number;
          nodes: Set<string>;
          members: GuildMember[];
        }
      >();
      for (const player of members) {
        const guild = player.guild ?? "Không guild";
        let entry = guilds.get(guild);
        if (!entry) {
          entry = { score: 0, players: 0, nodes: new Set(), members: [] };
          guilds.set(guild, entry);
        }
        const score = scoreByPlayer.get(player.id) ?? 0;
        const allocations = playerAllocations(player.id, contributions);
        entry.score += score;
        entry.players += 1;
        for (const allocation of allocations)
          entry.nodes.add(allocation.nodeId);
        entry.members.push({
          id: player.id,
          name: player.name,
          score,
          nodes: allocations.length,
        });
      }
      return {
        ...faction,
        islands: islands.filter((node) => node.owner === faction.id).length,
        guilds: [...guilds]
          .map(([guild, entry]) => ({
            guild,
            score: entry.score,
            players: entry.players,
            nodes: entry.nodes.size,
            members: entry.members.sort((a, b) => b.score - a.score),
          }))
          .sort((a, b) => b.score - a.score),
        score: members.reduce(
          (total, player) => total + (scoreByPlayer.get(player.id) ?? 0),
          0
        ),
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function nodeDetails(
  nodeId: string | null,
  islands: Island[],
  contributions: Contribution[],
  factions: Faction[],
  connectedByNode?: Map<string, Set<string>>
): NodeDetailData | null {
  if (!nodeId) return null;
  const island = islands.find((node) => node.id === nodeId);
  if (!island) return null;
  const connected = connectedByNode?.get(nodeId);
  const scores = scoresForNode(nodeId, contributions, factions).map(
    (faction) => ({
      ...faction,
      connected: connected ? connected.has(faction.id) : undefined,
    })
  );
  const attackers = contributions
    .filter((entry) => entry.nodeId === nodeId)
    .sort((a, b) => b.score - a.score)
    .map((entry) => ({
      ...entry,
      player: {
        id: entry.playerId,
        name: entry.name,
        faction: entry.faction,
        guild: entry.guild,
      },
      factionInfo: factions.find((faction) => faction.id === entry.faction),
    }));
  return {
    island,
    owner: factions.find((faction) => faction.id === island.owner),
    scores,
    total: scores.reduce((sum, faction) => sum + faction.score, 0),
    attackers,
  };
}

export function searchIslands(
  query: string,
  islands: Island[],
  limit = 6
): Island[] {
  const normalized = query.trim().toLocaleLowerCase("vi");
  if (!normalized) return [];
  return islands
    .filter((node) =>
      `${node.id} ${node.name}`.toLocaleLowerCase("vi").includes(normalized)
    )
    .slice(0, limit);
}
