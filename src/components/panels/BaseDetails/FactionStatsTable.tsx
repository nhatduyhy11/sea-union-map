import { useId, type CSSProperties } from "react";
import type { FactionNodeFilter } from "../../../domain/selectors";
import { compact } from "../../../utils/format";
import styles from "./BaseDetails.module.css";
import type {
  FactionIslandStats,
  IslandBucket,
  IslandBucketStats,
} from "../../../types";

const STAT_ROWS: {
  id: IslandBucket;
  className?: string;
  label: string;
  hint: string;
}[] = [
  {
    id: "claimable",
    label: "Mất",
    hint: "Đủ điểm, chưa chiếm: có điểm ≥ ngưỡng claim nhưng phe không sở hữu (bị outbid hoặc mất đường nối)",
  },
  { id: "owned", label: "Đang chiếm", hint: "Đảo phe đang sở hữu" },
  {
    id: "enough",
    className: `${styles.tinted} ${styles.sum}`,
    label: "Đủ điểm",
    hint: "Đang chiếm + mất",
  },
  {
    id: "below",
    className: styles.tinted,
    label: "Chưa đủ điểm",
    hint: "Có điểm nhưng dưới ngưỡng claim, phe không sở hữu",
  },
  {
    id: "touched",
    className: `${styles.total} ${styles.sum}`,
    label: "Tất cả",
    hint: "Đủ điểm + chưa đủ điểm: mọi đảo phe có điểm hoặc đang chiếm",
  },
];

// Bảng "Điểm phe trên các đảo": số đảo + tổng / trung bình / trung vị điểm
// phe theo từng tập đảo. Mỗi dòng cũng là một filter (radio ở header = không
// lọc).
export function FactionStatsTable({
  stats,
  color,
  activeFilter,
  onSelect,
  onToggle,
}: {
  stats: FactionIslandStats;
  color?: string;
  activeFilter: FactionNodeFilter | null;
  onSelect: (id: FactionNodeFilter | null) => void;
  onToggle: (id: FactionNodeFilter) => void;
}) {
  const radioName = useId();
  return (
    <table
      className={styles.stats}
      style={{ "--tint": color } as CSSProperties}
    >
      <thead>
        <tr>
          <th className={styles.pick}>
            <input
              type="radio"
              name={radioName}
              aria-label="Không lọc đảo"
              title="Không lọc đảo"
              checked={activeFilter === null}
              onChange={() => onSelect(null)}
            />
          </th>
          <th />
          <th>Đảo</th>
          <th>Tổng</th>
          <th>avg</th>
          <th>median</th>
        </tr>
      </thead>
      <tbody>
        {STAT_ROWS.map(({ id, className, label, hint }) => (
          <StatRow
            key={id}
            className={className}
            label={label}
            hint={hint}
            stats={stats[id]}
            radioName={radioName}
            active={activeFilter === id}
            onSelect={() => onSelect(id)}
            onToggle={() => onToggle(id)}
          />
        ))}
      </tbody>
    </table>
  );
}

// Dòng bảng cũng là filter: click cả dòng (hoặc radio ở cột đầu) chọn tập để
// highlight trên map, click lại dòng đang chọn thì bỏ lọc. Dòng 0 đảo không
// chọn được.
function StatRow({
  className,
  label,
  hint,
  stats,
  radioName,
  active,
  onSelect,
  onToggle,
}: {
  className?: string;
  label: string;
  hint: string;
  stats: IslandBucketStats;
  radioName: string;
  active: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const value = (points: number) => (stats.count ? compact(points) : "—");
  const disabled = stats.count === 0;
  return (
    <tr
      className={`${className ?? ""} ${disabled ? "" : styles.pickable} ${active ? styles.active : ""}`}
      title={hint}
      // Click radio chưa chọn: onChange chọn, rồi click nổi lên đây cũng chọn
      // (state lúc render chưa phải dòng này) → không bị bật/tắt hai lần.
      onClick={disabled ? undefined : onToggle}
    >
      <td className={styles.pick}>
        <input
          type="radio"
          name={radioName}
          aria-label={label}
          checked={active}
          disabled={disabled}
          onChange={onSelect}
        />
      </td>
      <th scope="row">{label}</th>
      <td>{stats.count}</td>
      <td>{value(stats.total)}</td>
      <td>{value(stats.mean)}</td>
      <td>{value(stats.median)}</td>
    </tr>
  );
}
