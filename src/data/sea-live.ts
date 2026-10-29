// Adapter FE cho dữ liệu crawl live. Đầu vào là JSON dump (sea-live.json) —
// script dump chỉ xuất JSON, không sinh file này. File này chọn dump nào được
// nạp; format ở sea-live/dump.ts, join game-id → layout-id và faction → hướng
// ở sea-live/join.ts (code client: sửa tay được, unit test ở sea-live.test.ts).

import raw from "./sea-live.json";
import type { SeaLiveDump } from "./sea-live/dump";

export type { CampRow, SeaLiveDump } from "./sea-live/dump";
export {
  buildLiveData,
  displayNameOf,
  layoutIdOf,
  type LiveData,
  type LivePlayerRow,
} from "./sea-live/join";

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

// Dump "live" — data ngày hiện tại của cụm LIVE_SERVER (các cụm khác chưa có
// live, xem src/data/snapshots.ts).
export const liveDump: SeaLiveDump = import.meta.env?.DEV
  ? await loadDevDump()
  : bundledDump;
