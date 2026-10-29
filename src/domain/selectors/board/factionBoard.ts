import type {
  Contribution,
  Faction,
  FactionBoardEntry,
  GuildMember,
  Island,
  Player,
  ServerGuildRow,
} from "../../../types";
import { playerAllocations, playersFromContributions } from "../nodeScores";

type GuildEntry = FactionBoardEntry["guilds"][number];
type SortBy = "power" | "score";

// Bucket gộp player không guild (hoặc guildId không có row server).
export const NO_GUILD = "Không guild";

// Faction board ("BXH Phe"). Live: guild rows + điểm guild là truth server
// (bảng "Tổng quan phe" trong dump; tổng guild khớp per-faction node-state exact);
// duy nhất member list khi expand guild mới derive từ node boards + briefs.
// Thứ tự phe giữ nguyên thứ tự cố định của `factions` (không sort theo điểm).
// Member match qua guildId (brief) — player không brief thì rơi NO_GUILD.
// Không có server guild data: path cũ tự tính từ contributions.
export function buildFactionBoard(
  contributions: Contribution[],
  factions: Faction[],
  islands: Island[],
  serverGuilds?: Record<string, ServerGuildRow[]>,
  sortBy: SortBy = "power"
): FactionBoardEntry[] {
  if (!serverGuilds || Object.keys(serverGuilds).length === 0)
    return buildFactionBoardComputed(contributions, factions, islands, sortBy);
  const players = playersFromContributions(contributions);
  return factions.map((faction) => {
    const rows = serverGuilds[faction.id] ?? [];
    const members = players.filter((player) => player.faction === faction.id);
    const scores = scoreByPlayer(contributions, faction.id);

    // id = guildId từ game (định danh unique sẵn, hai guild cùng tên vẫn
    // tách biệt); name = display name.
    const knownIds = new Set(rows.map((row) => row.guildId));
    const guilds: GuildEntry[] = rows.map((row) => {
      const bucket = buildGuild(
        row.guildId,
        row.name,
        members.filter((player) => player.guildId === row.guildId),
        scores,
        contributions
      );
      // Điểm guild là server truth — bucket score chỉ dùng cho member list.
      // Power ưu tiên row (guild brief), thiếu thì cộng member trong bucket.
      return { ...bucket, score: row.score, power: row.power ?? bucket.power };
    });
    const strays = members.filter(
      (player) => !player.guildId || !knownIds.has(player.guildId)
    );
    if (strays.length)
      guilds.push(
        buildGuild(NO_GUILD, NO_GUILD, strays, scores, contributions)
      );

    return factionEntry(
      faction,
      islands,
      guilds,
      rows.reduce((total, row) => total + row.score, 0),
      sortBy
    );
  });
}

// Legacy computed path (demo fixture): guild = bucket theo tên, mọi số tự tính.
function buildFactionBoardComputed(
  contributions: Contribution[],
  factions: Faction[],
  islands: Island[],
  sortBy: SortBy
): FactionBoardEntry[] {
  const players = playersFromContributions(contributions);
  const scores = scoreByPlayer(contributions);
  return factions.map((faction) => {
    const members = players.filter((player) => player.faction === faction.id);
    const groups = new Map<string, { name: string; players: Player[] }>();
    for (const player of members) {
      // Demo path không có server guild rows — rơi về tên guild khi player
      // thiếu guildId; NO_GUILD gộp mọi player trống cả hai.
      const key = player.guildId ?? player.guild ?? NO_GUILD;
      const group = groups.get(key);
      if (group) group.players.push(player);
      else groups.set(key, { name: player.guild ?? key, players: [player] });
    }
    const guilds = [...groups].map(([key, group]) =>
      buildGuild(key, group.name, group.players, scores, contributions)
    );
    return factionEntry(
      faction,
      islands,
      guilds,
      members.reduce(
        (total, player) => total + (scores.get(player.id) ?? 0),
        0
      ),
      sortBy
    );
  });
}

// Tổng điểm mỗi player; có factionId thì chỉ tính contributions của phe đó.
function scoreByPlayer(
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
function buildGuild(
  id: string,
  name: string,
  players: Player[],
  scores: Map<string, number>,
  contributions: Contribution[]
): GuildEntry {
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

function factionEntry(
  faction: Faction,
  islands: Island[],
  guilds: GuildEntry[],
  score: number,
  sortBy: SortBy
): FactionBoardEntry {
  const sorted = [...guilds].sort((a, b) =>
    sortBy === "power"
      ? (b.power ?? 0) - (a.power ?? 0) || b.score - a.score
      : b.score - a.score
  );
  return {
    ...faction,
    islands: islands.filter((node) => node.owner === faction.id).length,
    guilds: sorted,
    score,
    power: sorted.reduce((total, guild) => total + (guild.power ?? 0), 0),
  };
}
