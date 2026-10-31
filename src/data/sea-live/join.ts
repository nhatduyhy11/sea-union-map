// Join dump → model UI: game-id → layout-id, faction → hướng, ghép brief
// player/guild. Hàm thuần, unit test ở ../sea-live.test.ts.
// Node totals come from the server node state (dump nodeFactionScores); the
// per-node boards are capped at top-20 rows (docs/sea/SOCKET_PROTOCOL.md §3.5)
// and only list players.

import { layoutNodes, layoutRoutes } from "../map-layout";
import type {
  Contribution,
  Island,
  Route,
  ServerGuildRow,
  ServerPlayerRow,
} from "../../types";
import type { CampRow, SeaLiveDump } from "./dump";

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

// Prefix display id trong _name ("1-23Đảo Câu Cá" → "1-23") khớp layout id;
// trung tâm "4-1…" là layout "4"; base (type 1) nối qua dump.baseDir.
export function layoutIdOf(camp: CampRow): string | null {
  if (camp.type === 1) return null;
  if (camp.type === 5) return "4";
  const match = camp.name.match(/(\d+-\d+)(?!.*\d+-\d+)/);
  return match ? match[1] : null;
}

// Tên hiển thị: bỏ token display-id dính trong _name ("1-15Đảo Xích Đu" →
// "Đảo Xích Đu", "Khu nghỉ dưỡng Trường Đảo 3-2" → "Khu nghỉ dưỡng Trường
// Đảo") — UI tự ghép id riêng nên giữ nguyên sẽ thành "1-15 1-15Đảo…".
export function displayNameOf(camp: CampRow): string {
  if (camp.type === 1) return camp.name;
  return camp.name
    .replace(/\d+-\d+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Join game-id ↔ layout-id và faction → hướng; base (type 1) nối qua
// dump.baseDir, phe chiếm base đó nhận hướng của base.
interface CampIndex {
  gameIdByLayout: Map<string, number>;
  layoutIdByGame: Map<number, string>;
  factionDir: Record<number, string>;
}

function indexCamps(dump: SeaLiveDump): CampIndex {
  const gameIdByLayout = new Map<string, number>();
  const layoutIdByGame = new Map<number, string>();
  const factionDir: Record<number, string> = {};
  for (const [id, camp] of Object.entries(dump.camp)) {
    const gameId = Number(id);
    const dir = dump.baseDir[camp.name];
    if (dir) factionDir[dump.owner[id]] = dir;
    for (const layoutId of [layoutIdOf(camp), dir && `base-${dir}`]) {
      if (!layoutId) continue;
      gameIdByLayout.set(layoutId, gameId);
      layoutIdByGame.set(gameId, layoutId);
    }
  }
  return { gameIdByLayout, layoutIdByGame, factionDir };
}

// guildId: brief trước, fallback guildRoster — player bị server từ chối brief
// vẫn đúng guild.
function guildIdOf(dump: SeaLiveDump, playerId: number | string) {
  return dump.briefs[playerId]?.guildId ?? dump.guildRoster[playerId];
}

// Field player chung của contribution và row BXH, ghép từ brief; player không
// brief hiện #id.
function playerInfo(dump: SeaLiveDump, playerId: number) {
  const brief = dump.briefs[playerId];
  return {
    playerId: String(playerId),
    name: brief?.name ?? `#${playerId}`,
    guild: brief?.guild,
    guildId: guildIdOf(dump, playerId),
    power: brief?.power,
    server: brief?.server,
  };
}

function buildIslands(dump: SeaLiveDump, index: CampIndex): Island[] {
  return layoutNodes.map((node) => {
    const gameId = index.gameIdByLayout.get(node.id);
    const camp = gameId !== undefined ? dump.camp[gameId] : undefined;
    const ownerFaction = gameId !== undefined ? dump.owner[gameId] : undefined;
    const ownerDir = ownerFaction
      ? (index.factionDir[ownerFaction] ?? null)
      : null;
    return {
      ...node,
      name: camp ? displayNameOf(camp) : node.name,
      owner: node.base ? (node.owner ?? null) : ownerDir,
      claimThreshold: camp?.pointRequire ?? 1,
      factionScores:
        gameId !== undefined ? factionScoresOf(dump, index, gameId) : undefined,
    };
  });
}

// Điểm phe server tại node, key theo direction FE; dump cũ / node thiếu state
// → undefined (selector cộng nodeRows).
function factionScoresOf(
  dump: SeaLiveDump,
  index: CampIndex,
  gameId: number
): Record<string, number> | undefined {
  const raw = dump.nodeFactionScores?.[gameId];
  if (!raw) return undefined;
  const scores: Record<string, number> = {};
  for (const [camp, score] of Object.entries(raw)) {
    const dir = index.factionDir[Number(camp)];
    if (dir) scores[dir] = score;
  }
  return scores;
}

// Node-board rows (dump nodeRows; server cắt top-20/node):
// [gameNodeId, playerId, score, campId].
function buildContributions(
  dump: SeaLiveDump,
  index: CampIndex
): Contribution[] {
  return dump.nodeRows.flatMap(([gameId, playerId, score, camp]) => {
    const nodeId = index.layoutIdByGame.get(gameId);
    const faction = index.factionDir[camp];
    if (!nodeId || !faction) return [];
    return [{ nodeId, faction, score, ...playerInfo(dump, playerId) }];
  });
}

// BXH điểm server (board 117, top-200): rank + điểm là truth, tên/phe ghép từ
// brief + factionDir. Row phe không xác định (mất base) bị bỏ — không render được.
function buildPlayerBoard(
  dump: SeaLiveDump,
  factionDir: Record<number, string>
): LivePlayerRow[] {
  return dump.playerBoard.flatMap(([rank, playerId, score, camp]) => {
    const faction = camp !== null ? factionDir[camp] : undefined;
    if (!faction) return [];
    return [{ rank, faction, score, ...playerInfo(dump, playerId) }];
  });
}

// guildId → lực chiến guild: ưu tiên guild brief server (dump guildPower, f16);
// dump cũ thiếu thì cộng power mọi player brief — chỉ phủ member đã được brief
// nên thấp hơn thật.
function guildPowerOf(dump: SeaLiveDump): Map<string, number> {
  const guildPower = new Map<string, number>();
  for (const [playerId, brief] of Object.entries(dump.briefs)) {
    const guildId = guildIdOf(dump, playerId);
    if (guildId && brief.power)
      guildPower.set(guildId, (guildPower.get(guildId) ?? 0) + brief.power);
  }
  for (const [guildId, power] of Object.entries(dump.guildPower ?? {}))
    guildPower.set(guildId, power);
  return guildPower;
}

// Guild scores server (dump factionGuilds — bảng "Tổng quan phe"), key theo direction FE.
// Guild thiếu tên (không member nào được brief) hiện #id — BACKLOG_SEA.BE §1b.
function buildFactionGuilds(
  dump: SeaLiveDump,
  factionDir: Record<number, string>
): Record<string, ServerGuildRow[]> {
  const guildPower = guildPowerOf(dump);
  const result: Record<string, ServerGuildRow[]> = {};
  for (const [fid, rows] of Object.entries(dump.factionGuilds)) {
    const dir = factionDir[Number(fid)];
    if (!dir) continue;
    result[dir] = rows.map(([rawId, score]) => {
      const guildId = String(rawId);
      return {
        guildId,
        name: dump.guildNames[guildId] ?? `#${guildId}`,
        score,
        power: guildPower.get(guildId),
      };
    });
  }
  return result;
}

// Nhiên liệu phe, key theo direction FE. Phe không
// xác định (mất base) bị bỏ; dump cũ thiếu key → {}.
function buildFuel(
  dump: SeaLiveDump,
  factionDir: Record<number, string>
): Record<string, number> {
  const fuel: Record<string, number> = {};
  for (const [campId, value] of Object.entries(dump.fuel ?? {})) {
    const dir = factionDir[Number(campId)];
    if (dir) fuel[dir] = value;
  }
  return fuel;
}

export function buildLiveData(dump: SeaLiveDump): LiveData {
  const index = indexCamps(dump);
  return {
    islands: buildIslands(dump, index),
    contributions: buildContributions(dump, index),
    playerBoard: buildPlayerBoard(dump, index.factionDir),
    factionGuilds: buildFactionGuilds(dump, index.factionDir),
    // guildId → tên (từ brief member) — cùng nguồn guildNames trong dump.
    guildNames: dump.guildNames,
    fuel: buildFuel(dump, index.factionDir),
    factionDir: index.factionDir,
    routes: layoutRoutes,
  };
}
