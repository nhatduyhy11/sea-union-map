// Adapter FE cho dữ liệu crawl live. Đầu vào là JSON dump (sea-live.json) —
// script dump chỉ xuất JSON, không sinh file này. Join game-id → layout-id và
// faction → hướng là code client: sửa tay được, unit test ở sea-live.test.ts.
// Live totals sum the per-node boards, which the server caps at top-20 rows —
// known deviations vs the game numbers live in docs/STATS_MISMATCH.md.

import raw from "./sea-live.json";
import { layoutNodes, layoutRoutes } from "./map-layout";
import type {
  Contribution,
  Island,
  Route,
  ServerGuildRow,
  ServerPlayerRow,
} from "../types";

// CampGVG (client config, id == server node id): tên node, loại, ngưỡng chiếm.
interface CampRow {
  name: string;
  type: number;
  pointRequire: number;
}

// Hình dạng file dump — key số đến đây là string (JSON).
interface SeaLiveDump {
  snapshotAt: string;
  camp: Record<string, CampRow>;
  owner: Record<string, number>;
  nodeRows: [number, number, number, number][];
  playerBoard: [number, number, number, number | null][];
  factionGuilds: Record<string, [number, number][]>;
  guildNames: Record<string, string>;
  // Optional: dump cũ (trước khi parse guild brief f16) không có key này.
  guildPower?: Record<string, number>;
  guildRoster: Record<string, string>;
  briefs: Record<
    string,
    {
      name: string;
      guildId?: string;
      guild?: string;
      power?: number;
      server?: number;
    }
  >;
  baseDir: Record<string, string>;
}

// Tuple fields cần downcast (JSON import infer number[][], không biết tuple).
const bundledDump: SeaLiveDump = {
  ...raw,
  nodeRows: raw.nodeRows as SeaLiveDump["nodeRows"],
  playerBoard: raw.playerBoard as SeaLiveDump["playerBoard"],
  factionGuilds: raw.factionGuilds as unknown as SeaLiveDump["factionGuilds"],
};

// Dev: ưu tiên dump mới nhất ở public/sea-live-dev.json (gitignored —
// script dump ghi vào đây mỗi lần crawl, refresh browser là thấy). Thiếu file
// hay sai format thì rơi về bản baked trong bundle. Build: luôn dùng bản baked,
// không fetch. Guard ?.: ngoài Vite (tsx --test) import.meta.env không có →
// bundled luôn, không đụng fetch.
async function loadDevDump(): Promise<SeaLiveDump> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}sea-live-dev.json`);
    if (!res.ok) return bundledDump;
    const parsed = (await res.json()) as SeaLiveDump;
    console.info(`[sea-live] dùng dev dump (snapshot ${parsed.snapshotAt})`);
    return parsed;
  } catch {
    return bundledDump;
  }
}

const dump: SeaLiveDump = import.meta.env?.DEV
  ? await loadDevDump()
  : bundledDump;

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

const gameIdByLayout = new Map<string, number>();
// game faction id (1..4) → hướng của base phe đó đang giữ.
export const factionDir: Record<number, string> = {};
for (const [id, camp] of Object.entries(dump.camp)) {
  const gameId = Number(id);
  const layoutId = layoutIdOf(camp);
  if (layoutId) gameIdByLayout.set(layoutId, gameId);
  const dir = dump.baseDir[camp.name];
  if (dir) {
    gameIdByLayout.set(`base-${dir}`, gameId);
    factionDir[dump.owner[id]] = dir;
  }
}
const layoutIdByGame = new Map<number, string>();
for (const [layoutId, gameId] of gameIdByLayout)
  layoutIdByGame.set(gameId, layoutId);

export const islands: Island[] = layoutNodes.map((node) => {
  const gameId = gameIdByLayout.get(node.id);
  const camp = gameId !== undefined ? dump.camp[gameId] : undefined;
  const ownerFaction = gameId !== undefined ? dump.owner[gameId] : undefined;
  return {
    ...node,
    name: camp ? displayNameOf(camp) : node.name,
    owner: node.base
      ? (node.owner ?? null)
      : ownerFaction
        ? (factionDir[ownerFaction] ?? null)
        : null,
    // Boss detail nằm ở config khác (SkillBuffBossLO) — chưa map.
    boss: null,
    level: node.central ? 100 : node.tier === 1 ? 35 : 60,
    claimThreshold: camp?.pointRequire ?? 1,
  };
});

// Node-board rows (dump nodeRows; server cắt top-20/node):
// [gameNodeId, playerId, score, campId]. guildId: brief trước, fallback
// guildRoster — player bị server từ chối brief vẫn đúng guild.
export const contributions: Contribution[] = dump.nodeRows.flatMap(
  ([gameId, playerId, score, camp]) => {
    const nodeId = layoutIdByGame.get(gameId);
    const faction = factionDir[camp];
    if (!nodeId || !faction) return [];
    const brief = dump.briefs[playerId];
    return [
      {
        nodeId,
        playerId: String(playerId),
        name: brief?.name ?? `#${playerId}`,
        faction,
        guild: brief?.guild,
        guildId: brief?.guildId ?? dump.guildRoster[playerId],
        power: brief?.power,
        server: brief?.server,
        score,
      },
    ];
  }
);

// BXH điểm server (board 117, top-200): rank + điểm là truth, tên/phe ghép từ
// brief + factionDir. Row phe không xác định (mất base) bị bỏ — không render được.
export const playerBoard: (ServerPlayerRow & { faction: string })[] =
  dump.playerBoard.flatMap(([rank, playerId, score, camp]) => {
    const faction = camp !== null ? (factionDir[camp] ?? null) : null;
    if (!faction) return [];
    const brief = dump.briefs[playerId];
    return [
      {
        rank,
        playerId: String(playerId),
        name: brief?.name ?? `#${playerId}`,
        faction,
        guild: brief?.guild,
        power: brief?.power,
        server: brief?.server,
        score,
      },
    ];
  });

// guildId → lực chiến guild: ưu tiên guild brief server (dump guildPower, f16);
// dump cũ thiếu thì cộng power mọi player brief (guildId brief, fallback
// guildRoster) — chỉ phủ member đã được brief nên thấp hơn thật.
const guildPower = new Map<string, number>();
for (const [playerId, brief] of Object.entries(dump.briefs)) {
  const guildId = brief.guildId ?? dump.guildRoster[playerId];
  if (guildId && brief.power)
    guildPower.set(guildId, (guildPower.get(guildId) ?? 0) + brief.power);
}
for (const [guildId, power] of Object.entries(dump.guildPower ?? {}))
  guildPower.set(guildId, power);

// Guild scores server (dump factionGuilds — bảng "Tổng quan phe"), key theo direction FE.
// Guild thiếu tên (không member nào được brief) hiện #id — STATS_MISMATCH §5.1.
export const factionGuilds: Record<string, ServerGuildRow[]> = Object.entries(
  dump.factionGuilds
)
  .flatMap(([fid, rows]) => {
    const dir = factionDir[Number(fid)];
    if (!dir) return [];
    return [
      [
        dir,
        rows.map(([guildId, score]) => ({
          guildId: String(guildId),
          name: dump.guildNames[String(guildId)] ?? `#${guildId}`,
          score,
          power: guildPower.get(String(guildId)),
        })),
      ] as const,
    ];
  })
  .reduce<Record<string, ServerGuildRow[]>>(
    (acc, [dir, rows]) => ({ ...acc, [dir]: rows }),
    {}
  );

// guildId → tên (từ brief member) — cùng nguồn guildNames trong dump.
export const guildNames: Record<string, string> = dump.guildNames;

export const routes: Route[] = layoutRoutes;
