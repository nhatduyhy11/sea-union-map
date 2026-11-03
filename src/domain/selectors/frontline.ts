// Node giao tranh ("frontline"): phe claim đang bị phe nhì dồn điểm ngay cửa
// node. Hai điều kiện — áp lực + chân đứng — xem comment `frontlineNodes`.
import type {
  Contribution,
  Faction,
  FactionScore,
  Island,
  Route,
} from "../../types";
import { scoresForNode } from "./nodeScores";

// Áp lực tối thiểu coi là giao tranh: điểm phe nhì ≥ 40% điểm phe claim tại
// node — đối thủ trong tầm với dù phe claim đang 60% hay 70%.
export const PRESSURE_RATIO = 0.4;

// Một node giao tranh, kèm số liệu cho UI (badge, tooltip, list).
export interface Frontline {
  island: Island;
  // Phe đang chiếm node (s1).
  owner: Faction;
  // Phe nhì — phe không claim có điểm cao nhất tại node (s2), tức thanh điểm
  // cao nhất trong 3 phe còn lại trên node detail.
  rival: Faction;
  ownerScore: number;
  rivalScore: number;
  // rivalScore / ownerScore — mức áp lực; list sort giảm dần theo nó.
  ratio: number;
}

// Map nodeId → Frontline, chỉ chứa node giao tranh, sort theo ratio giảm dần.
//
// - Áp lực: PRESSURE_RATIO ≤ rival.score / owner.score ≤ 1. Phe claim phải
//   đứng đầu điểm: bị vượt điểm mà vẫn giữ node nghĩa là phe top đang bị cắt
//   đường — icon gift/flag, không phải giao tranh.
// - Chân đứng: phe nhì owns ít nhất một láng giềng. Điểm chỉ được xét khi còn
//   nối base qua lãnh thổ chính phe và lãnh thổ luôn liền khối quanh base,
//   nên "owns một láng giềng" ⟺ còn nối tới cửa node. Phe bị cắt đường có
//   chồng điểm thô vẫn hiện trên node detail (leaderboard không bao giờ ngắt)
//   nhưng bị loại ở đây: điểm đó đã ngưng xét ownership, áp lực thật nằm ở node cắt chứ không phải node
//   này. Đảo chưa chủ không xét — chưa phe nào thật sự commit.
export function frontlineNodes(
  islands: Island[],
  routes: Route[],
  contributions: Contribution[],
  factions: Faction[]
): Map<string, Frontline> {
  const ownerById = new Map(
    islands.map((node) => [node.id, node.owner ?? null])
  );
  const neighbors = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    const set = neighbors.get(a) ?? new Set<string>();
    set.add(b);
    neighbors.set(a, set);
  };
  for (const { source, target } of routes) {
    link(source, target);
    link(target, source);
  }

  const result = new Map<string, Frontline>();
  for (const island of islands) {
    if (island.base) continue;
    const owner = factions.find((faction) => faction.id === island.owner);
    if (!owner) continue;
    const scores = scoresForNode(island, contributions, factions);
    const ownerScore = scores.find((f) => f.id === owner.id)?.score ?? 0;
    if (ownerScore <= 0) continue;
    let rival: FactionScore | undefined;
    for (const entry of scores)
      if (entry.id !== owner.id && (!rival || entry.score > rival.score))
        rival = entry;
    if (
      !rival ||
      rival.score > ownerScore ||
      rival.score / ownerScore < PRESSURE_RATIO
    )
      continue;
    const rivalId = rival.id;
    const rivalScore = rival.score;
    const touching = [...(neighbors.get(island.id) ?? [])].some(
      (id) => ownerById.get(id) === rivalId
    );
    if (!touching) continue;
    result.set(island.id, {
      island,
      owner,
      rival,
      ownerScore,
      rivalScore,
      ratio: rivalScore / ownerScore,
    });
  }
  return new Map(
    [...result.entries()].sort(([, a], [, b]) => b.ratio - a.ratio)
  );
}
