import type {
  Contribution,
  Faction,
  FactionBoardEntry,
  GuildMember,
  Island,
  LeaderboardPlayer,
  NodeBoardEntry,
  Player,
  ServerGuildRow,
  ServerPlayerRow,
} from "../../types";
import {
  attackersForNode,
  playerAllocations,
  playersFromContributions,
  scoresForNode,
} from "./nodeScores";

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

// Node board ("Cứ điểm"): non-base islands in display-id order (1-1, 1-2 …
// 2-x, trung tâm); NodeBoard tự sort theo điểm khi bật checkbox.
export function buildNodeBoard(
  islands: Island[],
  contributions: Contribution[],
  factions: Faction[]
): NodeBoardEntry[] {
  return islands
    .filter((node) => !node.base)
    .map((island) => {
      const scores = scoresForNode(island.id, contributions, factions);
      const attackers = attackersForNode(island.id, contributions, factions);
      return {
        island,
        scores,
        total: scores.reduce((sum, faction) => sum + faction.score, 0),
        attackers,
      };
    })
    .sort((a, b) => compareNodeId(a.island.id, b.island.id));
}

// "1-2" < "1-10" < "2-1" < "4": so từng đoạn số.
function compareNodeId(a: string, b: string): number {
  const pa = a.split("-").map(Number);
  const pb = b.split("-").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff) return diff;
  }
  return 0;
}

// Faction board ("BXH Phe"). Live: guild rows + điểm guild là truth server
// (bảng "Tổng quan phe" trong dump; tổng guild khớp per-faction node-state exact);
// duy nhất member list khi expand guild mới derive từ node boards + briefs.
// Thứ tự phe giữ nguyên thứ tự cố định của `factions` (không sort theo điểm).
// Member match qua guildId (brief) — player không brief thì rơi "Không guild".
// Không có server guild data: path cũ tự tính từ contributions.
export function buildFactionBoard(
  contributions: Contribution[],
  factions: Faction[],
  islands: Island[],
  serverGuilds?: Record<string, ServerGuildRow[]>,
  sortBy: "power" | "score" = "power"
): FactionBoardEntry[] {
  if (!serverGuilds || Object.keys(serverGuilds).length === 0)
    return buildFactionBoardComputed(contributions, factions, islands, sortBy);
  return factions.map((faction) => {
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

    // id = guildId từ game (định danh unique sẵn, hai guild cùng tên vẫn
    // tách biệt); name = display name. "Không guild" là bucket gộp strays.
    const label = (
      id: string,
      name: string,
      players: number,
      nodes: Set<string>,
      memberList: GuildMember[],
      score: number,
      power: number
    ): FactionBoardEntry["guilds"][number] => ({
      id,
      name,
      guild: id,
      score,
      players,
      nodes: nodes.size,
      members: memberList.sort((a, b) => b.score - a.score),
      power,
    });

    const buildBucket = (guildKey: string, bucketMembers: Player[]) => {
      const nodes = new Set<string>();
      const memberList: GuildMember[] = [];
      let score = 0;
      let power = 0;
      for (const player of bucketMembers) {
        const playerScore = scoreByPlayer.get(player.id) ?? 0;
        const allocations = playerAllocations(player.id, contributions);
        score += playerScore;
        if (player.power) power += player.power;
        for (const allocation of allocations) nodes.add(allocation.nodeId);
        memberList.push({
          id: player.id,
          name: player.name,
          score: playerScore,
          nodes: allocations.length,
          power: player.power,
          server: player.server,
        });
      }
      return {
        guildKey,
        nodes,
        memberList,
        score,
        count: bucketMembers.length,
        power,
      };
    };

    const knownIds = new Set(rows.map((row) => row.guildId));
    const guildEntries = rows.map((row) => {
      const bucket = buildBucket(
        row.name,
        members.filter((player) => player.guildId === row.guildId)
      );
      // Điểm guild là server truth — bucket score chỉ dùng cho member list.
      // Power ưu tiên row (guild brief), thiếu thì cộng member trong bucket.
      return label(
        row.guildId,
        row.name,
        bucket.count,
        bucket.nodes,
        bucket.memberList,
        row.score,
        row.power ?? bucket.power
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
            "Không guild",
            bucket.count,
            bucket.nodes,
            bucket.memberList,
            bucket.score,
            bucket.power
          );
        })()
      );
    const sortedGuilds = [...guilds].sort((a, b) =>
      sortBy === "power"
        ? (b.power ?? 0) - (a.power ?? 0) || b.score - a.score
        : b.score - a.score
    );

    return {
      ...faction,
      islands: islands.filter((node) => node.owner === faction.id).length,
      guilds: sortedGuilds,
      score: rows.reduce((total, row) => total + row.score, 0),
      power: sortedGuilds.reduce(
        (total, guild) => total + (guild.power ?? 0),
        0
      ),
    };
  });
}

// Legacy computed path (demo fixture): guild = bucket theo tên, mọi số tự tính.
function buildFactionBoardComputed(
  contributions: Contribution[],
  factions: Faction[],
  islands: Island[],
  sortBy: "power" | "score" = "power"
): FactionBoardEntry[] {
  const players = playersFromContributions(contributions);
  const scoreByPlayer = new Map<string, number>();
  for (const entry of contributions)
    scoreByPlayer.set(
      entry.playerId,
      (scoreByPlayer.get(entry.playerId) ?? 0) + entry.score
    );
  return factions.map((faction) => {
    const members = players.filter((player) => player.faction === faction.id);
    const guilds = new Map<
      string,
      {
        name: string;
        score: number;
        players: number;
        nodes: Set<string>;
        members: GuildMember[];
        power: number;
      }
    >();
    for (const player of members) {
      // Demo path không có server guild rows — rơi về tên guild khi player
      // thiếu guildId; "Không guild" gộp mọi player trống cả hai.
      const guild = player.guildId ?? player.guild ?? "Không guild";
      let entry = guilds.get(guild);
      if (!entry) {
        entry = {
          name: player.guild ?? guild,
          score: 0,
          players: 0,
          nodes: new Set(),
          members: [],
          power: 0,
        };
        guilds.set(guild, entry);
      }
      const score = scoreByPlayer.get(player.id) ?? 0;
      const allocations = playerAllocations(player.id, contributions);
      entry.score += score;
      entry.players += 1;
      if (player.power) entry.power += player.power;
      for (const allocation of allocations) entry.nodes.add(allocation.nodeId);
      entry.members.push({
        id: player.id,
        name: player.name,
        score,
        nodes: allocations.length,
        power: player.power,
        server: player.server,
      });
    }
    return {
      ...faction,
      islands: islands.filter((node) => node.owner === faction.id).length,
      guilds: [...guilds]
        .map(([guild, entry]) => ({
          id: guild,
          name: entry.name,
          guild,
          score: entry.score,
          players: entry.players,
          nodes: entry.nodes.size,
          members: entry.members.sort((a, b) => b.score - a.score),
          power: entry.power,
        }))
        .sort((a, b) =>
          sortBy === "power"
            ? (b.power ?? 0) - (a.power ?? 0) || b.score - a.score
            : b.score - a.score
        ),
      score: members.reduce(
        (total, player) => total + (scoreByPlayer.get(player.id) ?? 0),
        0
      ),
      power: [...guilds.values()].reduce(
        (total, entry) => total + entry.power,
        0
      ),
    };
  });
}
