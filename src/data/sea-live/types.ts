import type { Contribution, Island, Route } from "../../types";

// One row of the server's global player board ("BXH điểm", dump playerBoard):
// rank + score are server truth; allocations per island are joined separately
// from node boards.
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

// Row BXH server đã resolve phe (row phe không xác định bị bỏ khi join).
export type LivePlayerRow = ServerPlayerRow & { faction: string };

// Kết quả join một dump → model UI. Hàm thuần: đổi cụm/ngày là gọi lại với
// dump khác (store dataset), không còn hằng module-level.
export interface LiveData {
  islands: Island[];
  contributions: Contribution[];
  playerBoard: LivePlayerRow[];
  factionGuilds: Record<string, ServerGuildRow[]>;
  guildNames: Record<string, string>;
  // Tổng Nhiên Liệu từng phe, key theo direction FE. Dump cũ thiếu key fuel
  // → {} (UI ẩn nhiên liệu, highlight fallback lực chiến).
  fuel: Record<string, number>;
  // game faction id (1..4) → hướng của base phe đó đang giữ.
  factionDir: Record<number, string>;
  routes: Route[];
}
