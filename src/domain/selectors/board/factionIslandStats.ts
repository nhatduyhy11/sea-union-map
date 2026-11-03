import type {
  FactionIslandStats,
  FactionScore,
  Island,
  IslandBucketStats,
  IslandPoints,
} from "../../../types";

// Thống kê điểm một phe dồn vào các đảo (base không tính), chia ba tập rời
// nhau theo owner (truth server) và ngưỡng claim:
// - owned: phe đang chiếm.
// - claimable: không chiếm, có điểm và đủ ngưỡng (bị outbid / cắt đường).
// - below: không chiếm, có điểm nhưng chưa đủ ngưỡng.
// enough = owned + claimable, touched = cả ba. Điểm/đảo lấy từ scoresByNode
// (cùng nguồn popup điểm trên canvas). enoughIslands giữ điểm từng đảo của
// tập enough (cho dot plot phân bố), sắp tăng dần theo điểm.
export function factionIslandStats(
  factionId: string,
  islands: Island[],
  scoresByNode: ReadonlyMap<string, FactionScore[]>
): FactionIslandStats {
  const owned: number[] = [];
  const claimable: number[] = [];
  const below: number[] = [];
  const enoughIslands: IslandPoints[] = [];
  for (const node of islands) {
    if (node.base) continue;
    const points =
      scoresByNode.get(node.id)?.find((entry) => entry.id === factionId)
        ?.score ?? 0;
    const isOwned = node.owner === factionId;
    if (!isOwned && points <= 0) continue;
    if (!isOwned && points < node.claimThreshold) {
      below.push(points);
      continue;
    }
    (isOwned ? owned : claimable).push(points);
    enoughIslands.push({
      id: node.id,
      name: node.name,
      points,
      owned: isOwned,
    });
  }
  enoughIslands.sort((a, b) => a.points - b.points);
  return {
    owned: bucket(owned),
    claimable: bucket(claimable),
    below: bucket(below),
    enough: bucket([...owned, ...claimable]),
    touched: bucket([...owned, ...claimable, ...below]),
    enoughIslands,
  };
}

function bucket(values: number[]): IslandBucketStats {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!values.length) return { count: 0, total, mean: 0, median: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return {
    count: values.length,
    total,
    mean: total / values.length,
    median:
      sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2,
  };
}
