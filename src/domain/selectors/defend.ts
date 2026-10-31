// Node cần thủ: đảo phe mình giữ nhưng điểm mỏng mà giáp ranh phe khác —
// icon shield-alert + fill màu phe nhạt trên canvas.
import type { Contribution, Faction, Island, Route } from "../../types";
import type { Frontline } from "./frontline";
import { scoresForNode } from "./nodeScores";

// Set nodeId cần thủ. Node giao tranh được loại trước (frontlineByNode) —
// đang đánh nhau thì là tranh chấp, không phải cảnh báo thủ. Base không xét
// (giữ icon phe làm mốc lãnh thổ). Láng giềng trung lập không tính — chưa
// phe nào thật sự đứng cạnh.
export function defendNodes(
  islands: Island[],
  routes: Route[],
  contributions: Contribution[],
  factions: Faction[],
  frontlineByNode: Map<string, Frontline>,
  effortByFaction: Map<string, number>
): Set<string> {
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

  const result = new Set<string>();
  for (const island of islands) {
    if (island.base || frontlineByNode.has(island.id)) continue;
    const owner = factions.find((faction) => faction.id === island.owner);
    if (!owner) continue;
    const scores = scoresForNode(island, contributions, factions);
    const ownerScore = scores.find((f) => f.id === owner.id)?.score ?? 0;
    const effort = effortByFaction.get(owner.id);
    if (effort === undefined || ownerScore >= effort) continue;
    const enemyNear = [...(neighbors.get(island.id) ?? [])].some((id) => {
      const neighborOwner = ownerById.get(id);
      return neighborOwner != null && neighborOwner !== island.owner;
    });
    if (enemyNear) result.add(island.id);
  }
  return result;
}
