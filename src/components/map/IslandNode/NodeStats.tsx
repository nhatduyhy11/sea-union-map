import { Pin } from "lucide-react";
import { compact } from "../../../utils/format";
import styles from "./NodeStats.module.css";
import type { FactionScore } from "../../../types";

export interface NodeStatsProps {
  nodeId: string;
  name: string;
  scores?: FactionScore[];
  pinned?: boolean;
  onTogglePin?: () => void;
}

export function NodeStats({
  nodeId,
  name,
  scores,
  pinned,
  onTogglePin,
}: NodeStatsProps) {
  if (!scores) return null;
  // Thanh màu phe định danh phe (thứ tự cố định theo mảng factions), không
  // kèm tên; số điểm nằm giữa thanh. Chiều dài thanh theo tỉ lệ điểm/tổng
  // node — cùng công thức với FactionScores (NodeDetails).
  const total = scores.reduce((sum, faction) => sum + faction.score, 0);
  return (
    <div className={`${styles.nodeStats} ${pinned ? styles.pinned : ""}`}>
      <div className={styles.statTitle}>
        <span className={styles.statName}>{name}</span>
        <span className={styles.statNote}>(điểm tối thiểu)</span>
        {onTogglePin && (
          <button
            className={`${styles.pinToggle} ${pinned ? styles.pinActive : ""}`}
            aria-pressed={pinned}
            aria-label={`${pinned ? "Bỏ ghim" : "Ghim"} điểm ${nodeId}`}
            onClick={onTogglePin}
          >
            <Pin size={12} />
          </button>
        )}
      </div>
      {scores.map((faction) => (
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
    </div>
  );
}
