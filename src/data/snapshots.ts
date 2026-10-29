// Snapshot lịch sử theo ngày event × cụm server:
// src/data/snapshots/<YYMMDD>/<server>.json (cùng format dump sea-live.json,
// ghi bằng `report.py --snapshot`). Vite tự phát hiện file qua glob — thêm
// snapshot = thêm file, không có manifest; mỗi file là một chunk lazy, chỉ
// tải khi người dùng chọn ngày/cụm đó.
//
// "Live" (src/data/sea-live.json, dev: public/sea-live-dev.json) chỉ có cụm
// LIVE_SERVER cho ngày hiện tại; cụm khác ở ngày hiện tại chưa hỗ trợ → store
// dataset fallback về snapshot gần nhất của cụm đó.

import type { SeaLiveDump } from "./sea-live";

export const LIVE_SERVER = "517";

const modules = import.meta.glob<{ default: unknown }>("./snapshots/*/*.json");

// "<day>/<server>" → loader.
const loaders = new Map<string, () => Promise<{ default: unknown }>>();
const daysByServer = new Map<string, Set<string>>();
for (const [path, load] of Object.entries(modules)) {
  const match = path.match(/\/snapshots\/(\d{6})\/(\d+)\.json$/);
  if (!match) continue;
  const [, day, server] = match;
  loaders.set(`${day}/${server}`, load);
  const days = daysByServer.get(server) ?? new Set<string>();
  days.add(day);
  daysByServer.set(server, days);
}

// Cụm có ít nhất một snapshot (+ cụm live), sort số tăng dần.
export const servers: string[] = [
  ...new Set([LIVE_SERVER, ...daysByServer.keys()]),
].sort((a, b) => Number(a) - Number(b));

export const hasSnapshot = (day: string, server: string) =>
  loaders.has(`${day}/${server}`);

// Ngày có snapshot gần nhất của cụm, không vượt quá `upTo` (day key so sánh
// được theo chuỗi vì cùng dạng YYMMDD).
export function latestSnapshotDay(server: string, upTo: string): string | null {
  const days = [...(daysByServer.get(server) ?? [])]
    .filter((day) => day <= upTo)
    .sort();
  return days.at(-1) ?? null;
}

export async function loadSnapshot(
  day: string,
  server: string
): Promise<SeaLiveDump> {
  const load = loaders.get(`${day}/${server}`);
  if (!load) throw new Error(`Không có snapshot ${day}/${server}`);
  return (await load()).default as SeaLiveDump;
}
