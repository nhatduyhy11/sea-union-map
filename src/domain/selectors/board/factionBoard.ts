import type {
  Contribution,
  Faction,
  FactionBoardEntry,
  GuildScore,
  Island,
  Player,
  ServerGuildRow,
} from "../../../types";
import { playersFromContributions } from "../nodeScores";
import {
  buildGuild,
  NO_GUILD,
  scoreByPlayer,
  sortGuilds,
  type SortBy,
} from "./guild";

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
  sortBy: SortBy = "power",
  fuel?: Record<string, number>
): FactionBoardEntry[] {
  if (!serverGuilds || Object.keys(serverGuilds).length === 0)
    return buildFactionBoardComputed(contributions, factions, islands, sortBy);
  const players = playersFromContributions(contributions);
  const touched = touchedByNode(contributions);
  return factions.map((faction) => {
    const rows = serverGuilds[faction.id] ?? [];
    const members = players.filter((player) => player.faction === faction.id);
    const scores = scoreByPlayer(contributions, faction.id);

    // id = guildId từ game (định danh unique sẵn, hai guild cùng tên vẫn
    // tách biệt); name = display name.
    const knownIds = new Set(rows.map((row) => row.guildId));
    const guilds: GuildScore[] = rows.map((row) => {
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
      sortBy,
      fuel?.[faction.id],
      touched
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
  const touched = touchedByNode(contributions);
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
      sortBy,
      undefined,
      touched
    );
  });
}

// nodeId → các phe có đóng góp điểm tại đảo. Cơ sở cho số "đã đánh" của
// BXH Phe — tính một lần, tra theo phe trong factionEntry.
function touchedByNode(
  contributions: Contribution[]
): Map<string, Map<string, number>> {
  const map = new Map<string, Map<string, number>>();
  for (const entry of contributions) {
    if (entry.score <= 0) continue;
    const scores = map.get(entry.nodeId) ?? new Map<string, number>();
    scores.set(entry.faction, (scores.get(entry.faction) ?? 0) + entry.score);
    map.set(entry.nodeId, scores);
  }
  return map;
}

function factionEntry(
  faction: Faction,
  islands: Island[],
  guilds: GuildScore[],
  score: number,
  sortBy: SortBy,
  fuel: number | undefined,
  touched: Map<string, Map<string, number>>
): FactionBoardEntry {
  const sorted = sortGuilds(guilds, sortBy);
  // Căn cứ luôn thuộc phe, không chiếm được: loại khỏi cả ba số đếm đảo.
  const nodes = islands.filter((node) => !node.base);
  const pointsAt = (node: Island) =>
    node.factionScores
      ? (node.factionScores[faction.id] ?? 0)
      : (touched.get(node.id)?.get(faction.id) ?? 0);
  return {
    ...faction,
    islands: nodes.filter((node) => node.owner === faction.id).length,
    // Đã đánh (touched): mọi đảo có điểm phe > 0, gồm cả đảo đang chiếm.
    // Nguồn điểm phe/đảo như scoresForNode: server state (đủ — node board bị
    // cắt top-20/đảo), dump cũ thiếu thì cộng contributions.
    touched: nodes.filter((node) => pointsAt(node) > 0).length,
    // Thuần ngưỡng điểm, không xét owner hay đường nối.
    claimable: nodes.filter((node) => {
      const points = pointsAt(node);
      return points > 0 && points >= node.claimThreshold;
    }).length,
    guilds: sorted,
    score,
    power: sorted.reduce((total, guild) => total + (guild.power ?? 0), 0),
    fuel,
  };
}

// Hạng phe theo tổng điểm (1 = dẫn đầu) — list vẫn giữ thứ tự cố định.
export function rankFactions(
  factions: FactionBoardEntry[]
): Map<string, number> {
  return new Map(
    [...factions]
      .sort((a, b) => b.score - a.score)
      .map((entry, index) => [entry.id, index + 1])
  );
}
