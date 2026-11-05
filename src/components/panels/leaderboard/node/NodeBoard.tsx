import { ArrowDown, ArrowUp, ArrowUpDown, type LucideIcon } from "lucide-react";
import { useFocusIslandOnBoard } from "../../../../hooks/useFocusIsland";
import { useFitMap } from "../../../../hooks/useFitMap";
import { NodeBoardFilters } from "./NodeBoardFilters";
import { NodeBoardRow } from "./NodeBoardRow";
import { useNodeBoardFilter, type ScoreSort } from "./useNodeBoardFilter";
import shared from "../shared.module.css";
import styles from "./NodeBoard.module.css";
import type { CanvasIcon } from "../../../../domain/selectors/canvasIcons";
import type { Faction } from "../../../../types";
import type { NodeBoardEntry } from "../../../../domain/selectors/board/types";

const SORT_UI: Record<ScoreSort, { Icon: LucideIcon; suffix: string }> = {
  none: { Icon: ArrowUpDown, suffix: "" },
  desc: { Icon: ArrowDown, suffix: " (giảm dần)" },
  asc: { Icon: ArrowUp, suffix: " (tăng dần)" },
};

// Tab Cứ điểm: mặc định theo id đảo (1-1, 1-2 …), lọc theo phe / trạng thái,
// sort theo tổng Điểm ST; tiêu đề đếm số cứ điểm đang hiển thị. Lọc list
// luôn chạy; Filter mode bật thì pill lọc cũng highlight canvas.
export function NodeBoard({
  nodes,
  factions,
  canvasIconByNode,
}: {
  nodes: NodeBoardEntry[];
  factions: Faction[];
  canvasIconByNode: ReadonlyMap<string, CanvasIcon>;
}) {
  const focusIslandOnBoard = useFocusIslandOnBoard();
  const fitMap = useFitMap(500);
  const { filter, toggleFilter, clearFilter, sort, cycleSort, displayNodes } =
    useNodeBoardFilter(nodes, canvasIconByNode);
  const { Icon: SortIcon, suffix } = SORT_UI[sort];
  return (
    <>
      <h2>Xếp hạng cứ điểm ({displayNodes.length})</h2>
      <NodeBoardFilters
        factions={factions}
        filter={filter}
        onToggle={toggleFilter}
        onClear={clearFilter}
      />
      <div className={shared.sortBar}>
        <button
          className={`${shared.sortOption} ${sort !== "none" ? styles.sortActive : ""}`}
          title="Bấm để đổi: giảm dần → tăng dần → không sort (theo số đảo 1-1, 1-2 …)."
          onClick={cycleSort}
        >
          <SortIcon size={11} />
          Sắp xếp theo điểm{suffix}
        </button>
      </div>
      {displayNodes.map((entry, index) => (
        <NodeBoardRow
          key={entry.island.id}
          entry={entry}
          rank={index + 1}
          canvasIcon={canvasIconByNode.get(entry.island.id)}
          onOpen={focusIslandOnBoard}
          onClose={fitMap}
        />
      ))}
    </>
  );
}
