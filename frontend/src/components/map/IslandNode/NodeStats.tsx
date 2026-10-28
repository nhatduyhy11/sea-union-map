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
  return (
    <div className={`${styles.nodeStats} ${pinned ? styles.pinned : ""}`}>
      <div className={styles.statTitle}>
        <span>{name}</span>
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
        <div key={faction.id}>
          <span>
            <i style={{ background: faction.color }} />
            {faction.short}
          </span>
          <b>{compact(faction.score)}</b>
        </div>
      ))}
    </div>
  );
}
