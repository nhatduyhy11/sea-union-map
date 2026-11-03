import type { FactionScore, Island, Route } from "../../types";
import { PRESSURE_RATIO } from "./frontline";

export type CanvasIcon =
  | "base"
  | "anchor"
  | "castle"
  | "belowClaim"
  | "frozen"
  | "frontline"
  | "defend"
  | "gifted"
  | "aftermath"
  | "overbuilt"
  | "plain";

// Owner bị vượt điểm mà chỉ giữ ≤ 30% điểm phe top: giữ node chỉ nhờ phe top
// bị cắt đường. Từ 40% (PRESSURE_RATIO) trở lên là vết tích tranh chấp lớn;
// khoảng giữa cố ý không gắn nhãn.
const GIFT_RATIO = 0.3;

// Mặt bằng điểm một phe trên các node đủ ngưỡng claim (kể cả bị cắt/outbid).
// Phân phối lệch phải — vài node nóng hút điểm gấp nhiều lần — nên mean bị
// đuôi kéo lên trên median: vượt mean là đầu tư đậm, dưới median là mỏng hơn
// một node điển hình.
export interface FactionEffort {
  mean: number;
  median: number;
}

// Chỉ cộng điểm trên node claimable: điểm trên node chưa đủ ngưỡng không có
// node tương ứng ở mẫu số. Phe chưa có node claimable không có entry —
// không gán 0/Infinity.
export function factionEfforts(
  islands: Island[],
  scoresByNode: ReadonlyMap<string, FactionScore[]>
): Map<string, FactionEffort> {
  const valuesByFaction = new Map<string, number[]>();
  for (const node of islands) {
    for (const entry of scoresByNode.get(node.id) ?? []) {
      if (entry.score <= 0 || entry.score < node.claimThreshold) continue;
      const values = valuesByFaction.get(entry.id) ?? [];
      values.push(entry.score);
      valuesByFaction.set(entry.id, values);
    }
  }
  return new Map(
    [...valuesByFaction].map(([id, values]) => {
      const sorted = [...values].sort((a, b) => a - b);
      const mid = sorted.length >> 1;
      const median =
        sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      const mean =
        values.reduce((sum, value) => sum + value, 0) / values.length;
      return [id, { mean, median }];
    })
  );
}

// Chỉ phân loại icon; owner luôn lấy nguyên từ server. Node có chủ xét theo
// owner có phải phe điểm cao nhất hay không; khiên chỉ xét khi chưa ra icon
// nào khác.
export function canvasIcons(
  islands: Island[],
  routes: Route[],
  scoresByNode: ReadonlyMap<string, FactionScore[]>,
  effortByFaction: ReadonlyMap<string, FactionEffort>,
  frontlineByNode: ReadonlyMap<string, unknown>
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
  // Đường tới cửa node phải đi từ base qua các node cùng owner, không đi
  // xuyên qua node đích.
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

  const classify = (node: Island): CanvasIcon => {
    if (node.base) return "base";
    const scores = scoresByNode.get(node.id) ?? [];
    const present = scores.filter((entry) => entry.score > 0);
    const idle: CanvasIcon = node.central ? "castle" : "anchor";
    if (!node.owner) {
      if (present.length === 0) return idle;
      const claimable = present.filter(
        (entry) => entry.score >= node.claimThreshold
      );
      if (claimable.length === 0) return "belowClaim";
      // Phe claimable còn nối đường mà chưa own chỉ xảy ra khi snapshot lệch
      // hoặc hòa điểm: không suy diễn owner hay gắn kéo sai.
      return claimable.every((entry) => !connected(node, entry.id))
        ? "frozen"
        : idle;
    }
    const ownerScore =
      scores.find((entry) => entry.id === node.owner)?.score ?? 0;
    let rival: FactionScore | undefined;
    for (const entry of present)
      if (entry.id !== node.owner && (!rival || entry.score > rival.score))
        rival = entry;
    const effort = effortByFaction.get(node.owner);
    if (!rival || rival.score <= ownerScore) {
      if (rival && rival.score / ownerScore >= PRESSURE_RATIO)
        return frontlineByNode.has(node.id) ? "frontline" : "aftermath";
      if (effort && ownerScore >= effort.mean) return "overbuilt";
    } else {
      // Owner bị vượt điểm mà vẫn giữ node: phe top đang bị cắt đường.
      const ratio = ownerScore / rival.score;
      if (ratio <= GIFT_RATIO) return "gifted";
      if (ratio >= PRESSURE_RATIO) return "aftermath";
    }
    const enemyNear = [...(neighbors.get(node.id) ?? [])].some((id) => {
      const neighborOwner = byId.get(id)?.owner;
      return neighborOwner != null && neighborOwner !== node.owner;
    });
    if (enemyNear && effort && ownerScore < effort.median) return "defend";
    return "plain";
  };

  return new Map(islands.map((node) => [node.id, classify(node)]));
}
