import type { FactionNodeFilter } from "../../../domain/selectors";
import { NODE_STATUS } from "../../shared/nodeStatus";
import pills from "../../shared/FilterPills.module.css";
import styles from "./BaseDetails.module.css";
import type { FactionIslandStats } from "../../../domain/selectors/board/types";

// Filter theo icon canvas — chỉ giữ filter có nghĩa khi nhìn từ một phe
// (Cướp / Vết mô tả cặp owner–phe top của đảo, không thuộc riêng phe nào).
// Filter theo điểm phe là các dòng của bảng FactionStatsTable.
const NODE_FILTERS: {
  id: "frontline" | "overbuilt";
  hint: string;
}[] = [
  {
    id: "frontline",
    hint: "Đảo giao tranh mà phe là một bên: đang chiếm và bị phe nhì ép, hoặc là phe nhì ép ngay cửa đảo",
  },
  {
    id: "overbuilt",
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
    <div className={`${pills.subTabs} ${pills.nodeFilters} ${styles.filters}`}>
      {NODE_FILTERS.map(({ id, hint }) => {
        const { Icon, label } = NODE_STATUS[id];
        const count = stats[id].size;
        return (
          <button
            key={id}
            className={activeFilter === id ? pills.selected : ""}
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
