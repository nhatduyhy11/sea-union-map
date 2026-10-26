// Adapter FE cho dữ liệu crawl live. Python (tools/socket_log/sea_to_ui.py)
// CHỈ dump JSON — không sinh file này. Join game-id → layout-id và faction →
// hướng là code client: sửa tay được, unit test ở sea-live.test.ts.
// Live totals sum the per-node boards, which the server caps at top-20 rows —
// known deviations vs the game numbers live in docs/STATS_MISMATCH.md.

import raw from "./sea-live.json";
import { layoutNodes, layoutRoutes } from "./map-layout";
import type { Contribution, Island, Route } from "../types";

// CampGVG (client config, id == server node id): tên node, loại, ngưỡng chiếm.
interface CampRow {
  name: string;
  type: number;
  pointRequire: number;
}

// Hình dạng dump của sea_to_ui.py — key số đến đây là string (JSON).
interface SeaLiveDump {
  snapshotAt: string;
  camp: Record<string, CampRow>;
  owner: Record<string, number>;
  nodeRows: [number, number, number, number][];
  briefs: Record<string, { name: string; guild?: string }>;
  baseDir: Record<string, string>;
}

// Chỉ nodeRows cần downcast (JSON import infer number[][], không biết tuple).
const bundledDump: SeaLiveDump = {
  ...raw,
  nodeRows: raw.nodeRows as SeaLiveDump["nodeRows"],
};

// Dev: ưu tiên dump mới nhất ở public/sea-live-dev.json (gitignored —
// sea_to_ui.py ghi vào đây mỗi lần crawl, refresh browser là thấy). Thiếu file
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
    name: camp?.name ?? node.name,
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

// Node-board rows (0x0c/0x0002 board 118, server cắt top-20/node):
// [gameNodeId, playerId, score, campId].
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
        score,
      },
    ];
  }
);

export const routes: Route[] = layoutRoutes;
