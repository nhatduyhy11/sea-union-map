import type {
  CanvasIcon,
  FactionBoardEntry,
  FactionScore,
  Island,
  Route,
} from "../../types";

// Không gán 0/Infinity cho phe chưa có node đủ điểm: effort chưa xác định.
export function factionEfforts(
  board: Pick<FactionBoardEntry, "id" | "score" | "claimable">[]
): Map<string, number> {
  return new Map(
    board
      .filter((entry) => entry.claimable > 0 && entry.score > 0)
      .map((entry) => [entry.id, entry.score / entry.claimable])
  );
}

// Chỉ phân loại icon; owner luôn lấy nguyên từ server. Đường tới cửa node
// phải đi từ base qua các node cùng owner, không đi xuyên qua node đích.
export function canvasIcons(
  islands: Island[],
  routes: Route[],
  scoresByNode: Map<string, FactionScore[]>,
  effortByFaction: Map<string, number>,
  frontlineByNode: ReadonlyMap<string, unknown>,
  defendNodeIds: ReadonlySet<string>
): Map<string, CanvasIcon> {
  const byId = new Map(islands.map((node) => [node.id, node]));
  const neighbors = new Map<string, Set<string>>();
  for (const { source, target } of routes) {
    for (const [a, b] of [
      [source, target],
      [target, source],
    ]) {
      const set = neighbors.get(a) ?? new Set<string>();
      set.add(b);
      neighbors.set(a, set);
    }
  }
  const reachable = new Map<string, Set<string>>();
  for (const base of islands) {
    if (!base.base || !base.owner) continue;
    const seen = reachable.get(base.owner) ?? new Set<string>();
    const queue = [base.id];
    seen.add(base.id);
    for (let i = 0; i < queue.length; i++) {
      for (const id of neighbors.get(queue[i]) ?? []) {
        if (!seen.has(id) && byId.get(id)?.owner === base.owner) {
          seen.add(id);
          queue.push(id);
        }
      }
    }
    reachable.set(base.owner, seen);
  }
  const connected = (node: Island, faction: string) =>
    [...(neighbors.get(node.id) ?? [])].some((id) =>
      reachable.get(faction)?.has(id)
    );

  return new Map(
    islands.map((node): [string, CanvasIcon] => {
      if (node.base) return [node.id, "base"];
      const scores = scoresByNode.get(node.id) ?? [];
      const present = scores.filter((entry) => entry.score > 0);
      const claimable = present.filter(
        (entry) => entry.score >= node.claimThreshold
      );
      const idle: CanvasIcon = node.central ? "castle" : "anchor";
      if (!node.owner) {
        if (present.length === 0) return [node.id, idle];
        if (claimable.length === 0) return [node.id, "belowClaim"];
        // Snapshot lệch hoặc hòa điểm: không suy diễn owner hay gắn kéo sai.
        return [
          node.id,
          claimable.every((entry) => !connected(node, entry.id))
            ? "frozen"
            : idle,
        ];
      }
      if (frontlineByNode.has(node.id)) return [node.id, "frontline"];
      if (defendNodeIds.has(node.id)) return [node.id, "defend"];
      const ownerScore =
        scores.find((entry) => entry.id === node.owner)?.score ?? 0;
      const cutOffAbove = claimable.filter(
        (entry) =>
          entry.id !== node.owner &&
          entry.score > ownerScore &&
          !connected(node, entry.id)
      );
      if (
        cutOffAbove.some((entry) => {
          const effort = effortByFaction.get(entry.id);
          return effort !== undefined && entry.score >= 2 * effort;
        })
      )
        return [node.id, "gifted"];
      const effort = effortByFaction.get(node.owner);
      if (
        effort !== undefined &&
        ownerScore >= 3 * effort &&
        cutOffAbove.length === 0
      )
        return [node.id, "overbuilt"];
      return [node.id, "plain"];
    })
  );
}
