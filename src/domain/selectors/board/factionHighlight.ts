import type { FactionBoardEntry } from "../../../types";

// Xếp hạng phe cho highlight BXH Phe (viền trái màu phe trên summary) — chỉ
// dùng cho highlight, số hạng trên row vẫn là thứ hạng theo điểm (rankFactions).
//
// Nhiên liệu là truth server: cột "Tổng Nhiên Liệu" của bảng BXH Phe in-game,
// rank phe cũng xếp theo nhiên liệu. Dump thiếu key `fuel`
// (data cũ) thì backward resolve về Điểm phe; không có số nào → trả Map rỗng,
// không highlight phe nào.
export function rankFactionsForHighlight(
  factions: FactionBoardEntry[]
): Map<string, number> {
  const byFuel = factions.some((entry) => (entry.fuel ?? 0) > 0);
  const value = (entry: FactionBoardEntry) =>
    byFuel ? (entry.fuel ?? 0) : entry.score;
  return new Map(
    [...factions]
      .filter((entry) => value(entry) > 0)
      .sort((a, b) => value(b) - value(a))
      .map((entry, index) => [entry.id, index + 1])
  );
}
