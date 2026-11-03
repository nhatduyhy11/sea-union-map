import { BicepsFlexed, Swords, type LucideIcon } from "lucide-react";
import type { FactionNodeFilter } from "../../../domain/selectors";
import board from "../leaderboard/shared.module.css";
import styles from "./BaseDetails.module.css";
import type { FactionIslandStats } from "../../../types";

// Filter theo icon canvas, cùng icon / nhãn với filter trạng thái BXH Cứ điểm
// — chỉ giữ filter có nghĩa khi nhìn từ một phe (Cướp / Vết mô tả cặp
// owner–phe top của đảo, không thuộc riêng phe nào). Filter theo điểm phe là
// các dòng của bảng FactionStatsTable.
const NODE_FILTERS: {
  id: "frontline" | "overbuilt";
  Icon: LucideIcon;
  label: string;
  hint: string;
}[] = [
  {
    id: "frontline",
    Icon: Swords,
    label: "Tranh",
    hint: "Đảo giao tranh mà phe là một bên: đang chiếm và bị phe nhì ép, hoặc là phe nhì ép ngay cửa đảo",
  },
  {
    id: "overbuilt",
    Icon: BicepsFlexed,
    label: "Dồn",
    hint: "Đảo phe đang chiếm với điểm vượt mức trung bình của phe",
  },
];

export function NodeFilterChips({
  stats,
  activeFilter,
  onToggle,
}: {
  stats: FactionIslandStats;
  activeFilter: FactionNodeFilter | null;
  onToggle: (id: FactionNodeFilter) => void;
}) {
  return (
    <div className={`${board.subTabs} ${board.nodeFilters} ${styles.filters}`}>
      {NODE_FILTERS.map(({ id, Icon, label, hint }) => {
        const count = stats[id].size;
        return (
          <button
            key={id}
            className={activeFilter === id ? board.selected : ""}
            aria-pressed={activeFilter === id}
            title={hint}
            disabled={count === 0}
            onClick={() => onToggle(id)}
          >
            <Icon size={13} aria-hidden="true" />
            {label}
            <b className={styles.filterCount}>{count}</b>
          </button>
        );
      })}
    </div>
  );
}
