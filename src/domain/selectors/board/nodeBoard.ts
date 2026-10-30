import type {
  Contribution,
  Faction,
  Island,
  NodeBoardEntry,
} from "../../../types";
import { attackersForNode, scoresForNode } from "../nodeScores";

// Node board ("Cứ điểm"): non-base islands in display-id order (1-1, 1-2 …
// 2-x, trung tâm); NodeBoard tự sort theo điểm khi bật checkbox.
export function buildNodeBoard(
  islands: Island[],
  contributions: Contribution[],
  factions: Faction[]
): NodeBoardEntry[] {
  return islands
    .filter((node) => !node.base)
    .map((island) => {
      const scores = scoresForNode(island, contributions, factions);
      const attackers = attackersForNode(island.id, contributions, factions);
      return {
        island,
        owner: factions.find((faction) => faction.id === island.owner),
        scores,
        total: scores.reduce((sum, faction) => sum + faction.score, 0),
        attackers,
      };
    })
    .sort((a, b) => compareNodeId(a.island.id, b.island.id));
}

// "1-2" < "1-10" < "2-1" < "4": so từng đoạn số.
function compareNodeId(a: string, b: string): number {
  const pa = a.split("-").map(Number);
  const pb = b.split("-").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff) return diff;
  }
  return 0;
}
