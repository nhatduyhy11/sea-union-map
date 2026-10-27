import type { Node } from "@xyflow/react";

export interface Position {
  x: number;
  y: number;
}

export interface Faction {
  id: string;
  name: string;
  short?: string;
  color: string;
  direction?: string;
}

export interface FactionScore extends Faction {
  score: number;
  // False when the faction lost its base link, suspending the score for the
  // node's claim; undefined where the rule was not evaluated.
  connected?: boolean;
}

export interface LayoutNode {
  id: string;
  name: string;
  position: Position;
  tier?: number;
  central?: boolean;
  base?: boolean;
  owner?: string | null;
  indexPending?: boolean;
}

export interface Island extends LayoutNode {
  owner: string | null;
  boss: string | null;
  level: number;
  // Points a faction needs to claim the node (see domain/claims.ts).
  claimThreshold: number;
}

export interface Route {
  source: string;
  target: string;
}

// Player identity — derived from node-board rows (playersFromContributions),
// never a separate source: crawled data only knows players through the
// per-node leaderboards.
export interface Player {
  id: string;
  name: string;
  faction: string;
  // Guild name from the player brief (0x0d/0x001f f11); the faction board
  // aggregates players by it. Demo data fills it, crawled data may not.
  guild?: string;
  // Guild id (brief f11 id part) — server guild rows (0x72/0x0025) are keyed
  // by id, so the faction board matches members through it. Demo data omits.
  guildId?: string;
}

// One row of a node's player leaderboard (SEA_STRUCTURE.md §3.7, top-N per
// node — N đủ lớn để giữ mọi player có impact). Identity đi cùng dòng, nên mọi
// thống kê (BXH cá nhân top-K, BXH phe, guild) đều derive từ các dòng này.
export interface Contribution {
  nodeId: string;
  playerId: string;
  name: string;
  faction: string;
  guild?: string;
  guildId?: string;
  score: number;
}

// One row of the server's global player board ("BXH điểm", 0x0c/0x0002 {117}):
// rank + score are server truth; allocations per island are joined separately
// from node boards (LEADERBOARD_SPECS.md §1.3).
export interface ServerPlayerRow {
  rank: number;
  playerId: string;
  name: string;
  faction: string | null;
  guild?: string;
  score: number;
}

// One row of the server's guild-score roster (0x72/0x0025 "Tổng quan phe"):
// the faction board renders these scores directly instead of summing rows.
export interface ServerGuildRow {
  guildId: string;
  // Tên guild từ brief member; guild không có member được brief thì #id.
  name: string;
  score: number;
}

export interface LeaderboardPlayer extends Player {
  factionInfo?: Faction;
  score: number;
  nodes: number;
  allocations: Contribution[];
}

export interface GuildScore {
  guild: string;
  score: number;
  players: number;
  // Số đảo guild có đóng góp — metadata của guild row ở BXH Phe.
  nodes: number;
  // Thành viên sort theo điểm — dữ liệu cho drill-down guild → thành viên.
  members: GuildMember[];
}

export interface GuildMember {
  id: string;
  name: string;
  score: number;
  nodes: number;
}

// Filter canvas theo guild/player — null = all. Guild dùng tên làm id
// ("Không guild" gộp mọi player không guild, khớp cách bucket ở BXH Phe).
export interface MapFilter {
  kind: "guild" | "player";
  id: string;
}

// "BXH Phe" entry: the faction's score is the sum of its member guilds'
// totals (see SEA_STRUCTURE.md §3.2), islands = owned nodes ("Chiếm đảo").
export interface FactionBoardEntry extends Faction {
  score: number;
  islands: number;
  guilds: GuildScore[];
}

// "Cứ điểm" board entry: one node ranked by the points all factions poured
// into it, with the per-faction breakdown ready for the expanded row.
export interface NodeBoardEntry {
  island: Island;
  total: number;
  scores: FactionScore[];
}

export interface Attacker extends Contribution {
  player?: Player;
  factionInfo?: Faction;
}

export interface NodeDetailData {
  island: Island;
  owner?: Faction;
  scores: FactionScore[];
  total: number;
  attackers: Attacker[];
}

export type IslandNodeData = Island & {
  factionInfo?: Faction;
  scores?: FactionScore[];
  pinned: boolean;
  showAll: boolean;
  active: boolean;
  dim: boolean;
  debug?: boolean;
  open: (id: string) => void;
  pin: (id: string) => void;
  [key: string]: unknown;
};

export type AppNode = Node<IslandNodeData, "island">;
