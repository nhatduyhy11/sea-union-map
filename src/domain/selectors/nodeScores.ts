// Pure queries: no React, UI state, or data source — everything arrives as
// arguments.
import type {
  Attacker,
  Contribution,
  Faction,
  FactionScore,
  Island,
  Player,
} from "../../types";

// Điểm phe tại node: số server (island.factionScores) khi dump có; không thì
// cộng node-board rows — server cắt top-20/node nên thấp hơn thật ở node đông.
export function scoresForNode(
  island: Island,
  contributions: Contribution[],
  factions: Faction[]
): FactionScore[] {
  const server = island.factionScores;
  const totals = new Map<string, number>();
  if (!server)
    for (const entry of contributions)
      if (entry.nodeId === island.id)
        totals.set(
          entry.faction,
          (totals.get(entry.faction) ?? 0) + entry.score
        );
  return factions.map((faction) => ({
    ...faction,
    score: (server ? server[faction.id] : totals.get(faction.id)) ?? 0,
  }));
}

export function attackersForNode(
  nodeId: string,
  contributions: Contribution[],
  factions: Faction[]
): Attacker[] {
  return contributions
    .filter((entry) => entry.nodeId === nodeId)
    .sort((a, b) => b.score - a.score)
    .map((entry) => ({
      ...entry,
      player: {
        id: entry.playerId,
        name: entry.name,
        faction: entry.faction,
        guild: entry.guild,
        guildId: entry.guildId,
        power: entry.power,
        server: entry.server,
      },
      factionInfo: factions.find((faction) => faction.id === entry.faction),
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
  for (const {
    playerId,
    name,
    faction,
    guild,
    guildId,
    power,
    server,
  } of contributions)
    if (!seen.has(playerId))
      seen.set(playerId, {
        id: playerId,
        name,
        faction,
        guild,
        guildId,
        power,
        server,
      });
  return [...seen.values()];
}
