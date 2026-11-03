import type {
  FactionIslandStats,
  FactionScore,
  Island,
  IslandBucketStats,
} from "../../../types";

// Thống kê điểm một phe dồn vào các đảo (base không tính), chia ba tập rời
// nhau theo owner (truth server) và ngưỡng claim:
// - owned: phe đang chiếm.
// - claimable: không chiếm, có điểm và đủ ngưỡng (bị outbid / cắt đường).
// - below: không chiếm, có điểm nhưng chưa đủ ngưỡng.
// enough = owned + claimable, touched = cả ba. Điểm/đảo lấy từ scoresByNode
// (cùng nguồn popup điểm trên canvas).
export function factionIslandStats(
  factionId: string,
  islands: Island[],
  scoresByNode: ReadonlyMap<string, FactionScore[]>
): FactionIslandStats {
  const owned: number[] = [];
  const claimable: number[] = [];
  const below: number[] = [];
  for (const node of islands) {
    if (node.base) continue;
    const points =
      scoresByNode.get(node.id)?.find((entry) => entry.id === factionId)
        ?.score ?? 0;
    if (node.owner === factionId) owned.push(points);
    else if (points <= 0) continue;
    else if (points >= node.claimThreshold) claimable.push(points);
    else below.push(points);
  }
  return {
    owned: bucket(owned),
    claimable: bucket(claimable),
    below: bucket(below),
    enough: bucket([...owned, ...claimable]),
    touched: bucket([...owned, ...claimable, ...below]),
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
