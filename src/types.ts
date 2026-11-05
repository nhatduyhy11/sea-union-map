import type { Node } from "@xyflow/react";
import type { CanvasIcon } from "./domain/selectors/canvasIcons";

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
  // Points a faction needs to claim the node (camp pointRequire).
  claimThreshold: number;
  // Server total per faction at this node (faction id → score). Undefined when
  // the dump lacks it; selectors then sum the capped node-board rows.
  factionScores?: Record<string, number>;
  // Boss of the node (monsterId) for the viewed server's event; undefined when
  // that server has no node-boss table.
  monsterId?: number;
}

export interface Route {
  source: string;
  target: string;
}

// Player identity — derived from node-board rows (playersFromContributions),
// never a separate source: the data only knows players through the
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

// One row of a node's player leaderboard (dump nodeRows, top-N per
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

export type IslandNodeData = Island & {
  canvasIcon?: CanvasIcon;
  factionInfo?: Faction;
  scores?: FactionScore[];
  pinned: boolean;
  showAll: boolean;
  active: boolean;
  dim: boolean;
  // Node khớp filter guild/player đang chạy — viền icon dày lên để nổi.
  matched?: boolean;
  // Node giao tranh (frontlineNodes — phe nhì dồn ≥40% điểm phe claim và owns
  // một láng giềng): fill chocolate đậm + icon kiếm trên canvas; rival = phe
  // nhì đang dồn điểm.
  frontline?: {
    rival: Faction;
    ratio: number;
  };
  // Node cần thủ (canvasIcon "defend" — điểm owner dưới trung vị của phe mà
  // giáp ranh phe khác): icon shield-alert + fill màu phe nhạt.
  defend?: boolean;
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
