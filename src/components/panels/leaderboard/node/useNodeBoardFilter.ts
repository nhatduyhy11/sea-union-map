import { useMemo, useState } from "react";
import type { NodeStatus } from "../../../shared/nodeStatus";
import type { CanvasIcon } from "../../../../domain/selectors/canvasIcons";
import type { NodeBoardEntry } from "../../../../domain/selectors/board/types";

// Pill phe lọc đảo theo phe đang chiếm; pill trạng thái lọc theo icon canvas
// của đảo (cùng kết quả phân loại với map); "Chưa chiếm" = đảo trung lập.
// Owner là owner server (đã áp rule ngắt đường).
export type NodeBoardFilter =
  | { kind: "faction"; id: string }
  | { kind: "status"; status: NodeStatus }
  | { kind: "unclaimed" };

export type ScoreSort = "none" | "asc" | "desc";

// Nút sort xoay vòng giảm dần → tăng dần → không sort (giữ thứ tự id đảo
// 1-1, 1-2 … của input).
const NEXT_SORT: Record<ScoreSort, ScoreSort> = {
  none: "desc",
  desc: "asc",
  asc: "none",
};

export function sameFilter(
  a: NodeBoardFilter | null,
  b: NodeBoardFilter
): boolean {
  switch (b.kind) {
    case "faction":
      return a?.kind === "faction" && a.id === b.id;
    case "status":
      return a?.kind === "status" && a.status === b.status;
    case "unclaimed":
      return a?.kind === "unclaimed";
  }
}

function matches(
  filter: NodeBoardFilter,
  entry: NodeBoardEntry,
  canvasIcon: CanvasIcon | undefined
): boolean {
  switch (filter.kind) {
    case "faction":
      return entry.owner?.id === filter.id;
    case "status":
      return canvasIcon === filter.status;
    case "unclaimed":
      return !entry.owner;
  }
}

// State local, rời board là reset.
export function useNodeBoardFilter(
  nodes: NodeBoardEntry[],
  canvasIconByNode: ReadonlyMap<string, CanvasIcon>
) {
  const [filter, setFilter] = useState<NodeBoardFilter | null>(null);
  const [sort, setSort] = useState<ScoreSort>("none");
  const displayNodes = useMemo(() => {
    const filtered = filter
      ? nodes.filter((entry) =>
          matches(filter, entry, canvasIconByNode.get(entry.island.id))
        )
      : nodes;
    if (sort === "none") return filtered;
    const sign = sort === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => sign * (a.total - b.total));
  }, [nodes, canvasIconByNode, filter, sort]);
  return {
    filter,
    toggleFilter: (next: NodeBoardFilter) =>
      setFilter(sameFilter(filter, next) ? null : next),
    clearFilter: () => setFilter(null),
    sort,
    cycleSort: () => setSort(NEXT_SORT[sort]),
    displayNodes,
  };
}
