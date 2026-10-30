import type {
  Contribution,
  Faction,
  Island,
  NodeDetailData,
} from "../../types";
import { attackersForNode, scoresForNode } from "./nodeScores";

export function nodeDetails(
  nodeId: string | null,
  islands: Island[],
  contributions: Contribution[],
  factions: Faction[],
  connectedByNode?: Map<string, Set<string>>
): NodeDetailData | null {
  if (!nodeId) return null;
  const island = islands.find((node) => node.id === nodeId);
  if (!island) return null;
  const connected = connectedByNode?.get(nodeId);
  const scores = scoresForNode(island, contributions, factions).map(
    (faction) => ({
      ...faction,
      connected: connected ? connected.has(faction.id) : undefined,
    })
  );
  const attackers = attackersForNode(nodeId, contributions, factions);
  return {
    island,
    owner: factions.find((faction) => faction.id === island.owner),
    scores,
    total: scores.reduce((sum, faction) => sum + faction.score, 0),
    attackers,
  };
}
