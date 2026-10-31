import type { Node } from "@xyflow/react";

export interface Position {
  x: number;
  y: number;
}

export interface Faction {
  id: string;
  name: string;
  // Edge/swatch/viền đảo.
  color: string;
  // Text label tên phe — tách khỏi color theo rule màu label.
  labelColor: string;
  // Đè màu edge canvas khi bỏ trống thì edge dùng color. Chỉ cần khi màu phe
  // quá sáng cho connection ở opacity thấp (hiện chỉ phe vàng đặt).
  edgeColor?: string;
}

export interface FactionScore extends Faction {
  score: number;
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
  // Points a faction needs to claim the node (CampGVG pointRequire).
  claimThreshold: number;
  // Server total per faction at this node (faction id → score). Undefined when
  // the dump lacks it; selectors then sum the capped node-board rows.
  factionScores?: Record<string, number>;
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
  // Guild name from the player brief (dump briefs); the faction board
  // aggregates players by it. Players without a brief leave it unset.
  guild?: string;
  // Guild id (from the dump briefs) — server guild rows (dump factionGuilds) are keyed
  // by id, so the faction board matches members through it.
  guildId?: string;
  power?: number;
  server?: number;
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
  power?: number;
  server?: number;
}

// One row of the server's global player board ("BXH điểm", dump playerBoard):
// rank + score are server truth; allocations per island are joined separately
// from node boards (LEADERBOARD_SPECS.md §1.3).
export interface ServerPlayerRow {
  rank: number;
  playerId: string;
  name: string;
  faction: string | null;
  guild?: string;
  guildId?: string;
  score: number;
  power?: number;
  server?: number;
}

// One row of the server's guild-score roster ("Tổng quan phe", dump factionGuilds):
// the faction board renders these scores directly instead of summing rows.
export interface ServerGuildRow {
  guildId: string;
  // Tên guild từ brief member; guild không có member được brief thì #id.
  name: string;
  score: number;
  // Lực chiến guild: guild brief server (f16), fallback tổng player brief.
  power?: number;
  server?: number;
}

export interface LeaderboardPlayer extends Player {
  factionInfo?: Faction;
  // Hạng trên board server (board 117) — badge đầu row, không đổi theo sort.
  rank: number;
  score: number;
  nodes: number;
  allocations: Contribution[];
}

export interface GuildScore {
  // Guild identity: guildId từ game (unique sẵn — hai guild cùng tên vẫn tách
  // biệt); bucket gộp player không guild dùng nguyên chuỗi "Không guild".
  id: string;
  // Display name: tên guild (hoặc "Không guild")
  name: string;
  // Alias của id — giữ tương thích với code cũ / tests
  guild: string;
  score: number;
  players: number;
  // Số đảo guild có đóng góp — metadata của guild row ở BXH Phe.
  nodes: number;
  // Thành viên sort theo điểm — dữ liệu cho drill-down guild → thành viên.
  members: GuildMember[];
  power?: number;
  server?: number;
  guildId?: string;
}

export interface GuildMember {
  id: string;
  name: string;
  score: number;
  nodes: number;
  power?: number;
  server?: number;
}

// Filter canvas theo guild/player — null = all.
// Guild dùng guildId từ game làm identity; bucket "Không guild" giữ nguyên
// chuỗi "Không guild".
export interface MapFilter {
  kind: "guild" | "player";
  id: string;
}

// Alias CanvasFilter cho đồng nhất với tài liệu và backlog
export type CanvasFilter = MapFilter;

// "BXH Phe" entry: the faction's score is the sum of its member guilds'
// totals (see SEA_STRUCTURE.md §3.2), islands = owned nodes ("Chiếm đảo").
export interface FactionBoardEntry extends Faction {
  score: number;
  // Tổng lực chiến các guild trong phe (0 = chưa có power data).
  power: number;
  islands: number;
  // Tổng Nhiên Liệu phe, undefined = dump thiếu fuel (data cũ)
  // — UI ẩn "(nhiên liệu)", highlight fallback Điểm phe (factionHighlight).
  fuel?: number;
  guilds: GuildScore[];
}

// "Cứ điểm" board entry: one node ranked by the points all factions poured
// into it, with the per-faction breakdown ready for the expanded row.
export interface NodeBoardEntry {
  island: Island;
  // Phe đang chiếm (undefined = chưa ai chiếm) — tô màu row.
  owner?: Faction;
  total: number;
  scores: FactionScore[];
  attackers: Attacker[];
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
  // Node khớp filter guild/player đang chạy — viền icon dày lên để nổi.
  matched?: boolean;
  debug?: boolean;
  // Đóng góp của player đang lọc trên đảo (dùng để highlight thanh điểm phe).
  playerHighlight?: {
    faction: string;
    score: number;
  };
  open: (id: string) => void;
  pin: (id: string) => void;
  [key: string]: unknown;
};

export type AppNode = Node<IslandNodeData, "island">;
