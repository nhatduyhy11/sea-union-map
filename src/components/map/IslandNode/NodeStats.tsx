import { Pin } from "lucide-react";
import { FactionScoreBars } from "../../shared/FactionScoreBars";
import { compact } from "../../../utils/format";
import styles from "./NodeStats.module.css";
import type { FactionScore } from "../../../types";

export interface NodeStatsProps {
  nodeId: string;
  name: string;
  claimThreshold: number;
  // Màu phe đại diện (owner, hoặc phe đủ ngưỡng claim nếu đảo chưa chủ) —
  // pha nhạt làm nền popup qua CSS.
  tint?: string;
  scores?: FactionScore[];
  pinned?: boolean;
  onTogglePin?: () => void;
}

export function NodeStats({
  nodeId,
  name,
  claimThreshold,
  tint,
  scores,
  pinned,
  onTogglePin,
}: NodeStatsProps) {
  if (!scores) return null;
  const total = scores.reduce((sum, faction) => sum + faction.score, 0);
  return (
    <div
      className={`${styles.nodeStats} ${tint ? styles.tinted : ""} ${pinned ? styles.pinned : ""}`}
      style={tint ? ({ "--tint": tint } as React.CSSProperties) : undefined}
    >
      <div className={styles.statTitle}>
        <span className={styles.statName}>{name}</span>
        {/* Ngưỡng chiếm đảo (điểm tối thiểu) — value thay chữ, như ô điểm in-game. */}
        <span className={styles.statNote}>({compact(claimThreshold)})</span>
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
      <FactionScoreBars scores={scores} total={total} />
    </div>
  );
}
