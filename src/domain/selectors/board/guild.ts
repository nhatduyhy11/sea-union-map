import type {
  Contribution,
  GuildMember,
  GuildScore,
  Player,
} from "../../../types";
import { playerAllocations } from "../nodeScores";

export type SortBy = "power" | "score";

// Bucket gộp player không guild (hoặc guildId không có row server).
export const NO_GUILD = "Không guild";

// Tổng điểm mỗi player; có factionId thì chỉ tính contributions của phe đó.
export function scoreByPlayer(
  contributions: Contribution[],
  factionId?: string
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const entry of contributions)
    if (!factionId || entry.faction === factionId)
      scores.set(
        entry.playerId,
        (scores.get(entry.playerId) ?? 0) + entry.score
      );
  return scores;
}

// Gộp players thành một guild entry: score/power cộng từ member, nodes đếm
// node unique, member list sort theo điểm giảm dần.
export function buildGuild(
  id: string,
  name: string,
  players: Player[],
  scores: Map<string, number>,
  contributions: Contribution[]
): GuildScore {
  const nodes = new Set<string>();
  const members: GuildMember[] = [];
  let score = 0;
  let power = 0;
  for (const player of players) {
    const playerScore = scores.get(player.id) ?? 0;
    const allocations = playerAllocations(player.id, contributions);
    score += playerScore;
    if (player.power) power += player.power;
    for (const allocation of allocations) nodes.add(allocation.nodeId);
    members.push({
      id: player.id,
      name: player.name,
      score: playerScore,
      nodes: allocations.length,
      power: player.power,
      server: player.server,
    });
  }
  return {
    id,
    name,
    guild: id,
    score,
    players: players.length,
    nodes: nodes.size,
    members: members.sort((a, b) => b.score - a.score),
    power,
  };
}

// Sort guild: "power" = lực chiến giảm dần (hoà thì theo điểm), "score" = điểm.
export function sortGuilds(guilds: GuildScore[], sortBy: SortBy): GuildScore[] {
  return [...guilds].sort((a, b) =>
    sortBy === "power"
      ? (b.power ?? 0) - (a.power ?? 0) || b.score - a.score
      : b.score - a.score
  );
}
