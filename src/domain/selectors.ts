// Pure queries: no React, UI state, or dependency on the demo fixture.
import type {
  Contribution,
  Faction,
  FactionBoardEntry,
  FactionScore,
  Island,
  LeaderboardPlayer,
  NodeBoardEntry,
  NodeDetailData,
  Player,
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

export function buildLeaderboard(
  players: Player[],
  contributions: Contribution[],
  factions: Faction[]
): LeaderboardPlayer[] {
  return players
    .map((player) => {
      const allocations = playerAllocations(player.id, contributions);
      return {
        ...player,
        factionInfo: factions.find((faction) => faction.id === player.faction),
        score: allocations.reduce((total, entry) => total + entry.score, 0),
        nodes: allocations.length,
        allocations,
      };
    })
    .sort((a, b) => b.score - a.score);
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

// Faction board ("BXH Phe"): the faction's total is the sum of its member
// guilds' totals — players without a guild pool under a shared fallback row.
export function buildFactionBoard(
  players: Player[],
  contributions: Contribution[],
  factions: Faction[],
  islands: Island[]
): FactionBoardEntry[] {
  const scoreByPlayer = new Map(
    players.map((player) => [
      player.id,
      playerAllocations(player.id, contributions).reduce(
        (total, entry) => total + entry.score,
        0
      ),
    ])
  );
  return factions
    .map((faction) => {
      const members = players.filter((player) => player.faction === faction.id);
      const guilds = new Map<string, { score: number; players: number }>();
      for (const player of members) {
        const guild = player.guild ?? "Không guild";
        const entry = guilds.get(guild) ?? { score: 0, players: 0 };
        guilds.set(guild, {
          score: entry.score + (scoreByPlayer.get(player.id) ?? 0),
          players: entry.players + 1,
        });
      }
      return {
        ...faction,
        islands: islands.filter((node) => node.owner === faction.id).length,
        guilds: [...guilds]
          .map(([guild, entry]) => ({ guild, ...entry }))
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
  players: Player[],
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
      player: players.find((player) => player.id === entry.playerId),
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
