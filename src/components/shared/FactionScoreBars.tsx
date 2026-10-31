import { compact } from "../../utils/format";
import styles from "./FactionScoreBars.module.css";
import type { FactionScore } from "../../types";

export interface FactionScoreBarsProps {
  scores: FactionScore[];
  total: number;
  // Ẩn bar của phe chưa có đóng góp (0 điểm) thay vì bar rỗng.
  hideEmpty?: boolean;
}

// Thanh điểm phe: màu phe định danh phe (thứ tự cố định theo mảng factions),
// không kèm tên; số điểm nằm giữa thanh, chiều dài bar theo tỉ lệ điểm/tổng.
// Dùng chung NodeStats (canvas) và NodeDetails (panel).
export function FactionScoreBars({
  scores,
  total,
  hideEmpty,
}: FactionScoreBarsProps) {
  const bars = hideEmpty
    ? scores.filter((faction) => faction.score > 0)
    : scores;
  return (
    <>
      {bars.map((faction) => (
        <div key={faction.id} className={styles.scoreBar}>
          <div
            className={styles.scoreFill}
            style={{
              width: `${total ? (faction.score / total) * 100 : 0}%`,
              background: faction.color,
            }}
          />
          <b className={styles.scoreValue}>{compact(faction.score)}</b>
        </div>
      ))}
    </>
  );
}
