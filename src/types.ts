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
