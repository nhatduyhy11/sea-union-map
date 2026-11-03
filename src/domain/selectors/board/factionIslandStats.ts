import type { CanvasIcon } from "../canvasIcons";
import type { FactionScore, Island } from "../../../types";
import type {
  FactionIslandStats,
  FactionNodeFilter,
  IslandBucket,
  IslandBucketStats,
  IslandPoints,
} from "./types";

// Thống kê điểm một phe dồn vào các đảo (base không tính), một vòng duyệt cho
// cả số liệu lẫn tập đảo của từng filter để số đếm và đảo được highlight luôn
// khớp nhau. Ba tập rời nhau theo owner (truth server) và ngưỡng claim:
// - owned: phe đang chiếm.
// - claimable: không chiếm, có điểm và đủ ngưỡng (bị outbid / cắt đường).
// - below: không chiếm, có điểm nhưng chưa đủ ngưỡng.
// enough = owned + claimable, touched = cả ba. Ngoài ra:
// - frontline: node giao tranh mà phe là một trong hai bên — owner hoặc rival
//   (phe nhì đứng ở cửa node). Phe chỉ có điểm lẻ trên node hai phe khác đang
//   giành không tính.
// - overbuilt: icon overbuilt trên đảo phe đang chiếm (icon đo điểm owner).
// Điểm/đảo lấy từ scoresByNode (cùng nguồn popup điểm trên canvas). ids giữ
// thứ tự islands; enoughIslands sắp tăng dần theo điểm (cho dot plot).
export function factionIslandStats(
  factionId: string,
  islands: Island[],
  scoresByNode: ReadonlyMap<string, FactionScore[]>,
  canvasIconByNode: ReadonlyMap<string, CanvasIcon>,
  frontlineByNode: ReadonlyMap<
    string,
    { owner: { id: string }; rival: { id: string } }
  >
): FactionIslandStats {
  const buckets = Object.fromEntries(
    BUCKETS.map((key) => [key, { ids: [] as string[], points: [] as number[] }])
  ) as Record<IslandBucket, { ids: string[]; points: number[] }>;
  const add = (keys: IslandBucket[], id: string, points: number) => {
    for (const key of keys) {
      buckets[key].ids.push(id);
      buckets[key].points.push(points);
    }
  };
  const frontline = new Set<string>();
  const overbuilt = new Set<string>();
  const enoughIslands: IslandPoints[] = [];
  for (const node of islands) {
    if (node.base) continue;
    const points =
      scoresByNode.get(node.id)?.find((entry) => entry.id === factionId)
        ?.score ?? 0;
    const isOwned = node.owner === factionId;
    const front = frontlineByNode.get(node.id);
    if (front && (front.owner.id === factionId || front.rival.id === factionId))
      frontline.add(node.id);
    if (isOwned && canvasIconByNode.get(node.id) === "overbuilt")
      overbuilt.add(node.id);
    if (!isOwned && points <= 0) continue;
    if (!isOwned && points < node.claimThreshold) {
      add(["below", "touched"], node.id, points);
      continue;
    }
    add(
      [isOwned ? "owned" : "claimable", "enough", "touched"],
      node.id,
      points
    );
    enoughIslands.push({
      id: node.id,
      name: node.name,
      points,
      owned: isOwned,
    });
  }
  enoughIslands.sort((a, b) => a.points - b.points);
  const stats = Object.fromEntries(
    BUCKETS.map((key) => [key, bucket(buckets[key].ids, buckets[key].points)])
  ) as Record<IslandBucket, IslandBucketStats>;
  return { ...stats, frontline, overbuilt, enoughIslands };
}

const BUCKETS: IslandBucket[] = [
  "owned",
  "claimable",
  "below",
  "enough",
  "touched",
];

// Tập đảo của một filter.
export function factionFilterIds(
  stats: FactionIslandStats,
  filter: FactionNodeFilter
): ReadonlySet<string> {
  return filter === "frontline" || filter === "overbuilt"
    ? stats[filter]
    : stats[filter].ids;
}

function bucket(ids: string[], values: number[]): IslandBucketStats {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!values.length)
    return { count: 0, total, mean: 0, median: 0, ids: new Set() };
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return {
    count: values.length,
    total,
    mean: total / values.length,
    median:
      sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2,
    ids: new Set(ids),
  };
}
