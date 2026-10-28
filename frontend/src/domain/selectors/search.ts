import type { Island } from "../../types";

export function searchIslands(
  query: string,
  islands: Island[],
  limit = 6
): Island[] {
  const normalized = query.trim().toLocaleLowerCase("vi");
  if (!normalized) return [];
  return islands
    .filter((node) =>
      `${node.id} ${node.name}`.toLocaleLowerCase("vi").includes(normalized)
    )
    .slice(0, limit);
}
