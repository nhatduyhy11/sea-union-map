import { Pin } from "lucide-react";
import { FactionScoreBars } from "../../shared/FactionScoreBars";
import { compact } from "../../../utils/format";
import styles from "./NodeStats.module.css";
import type { FactionScore } from "../../../types";

export interface NodeStatsProps {
  nodeId: string;
  name?: string;
  claimThreshold: number;
  hasOwner?: boolean;
  // Màu phe đại diện (owner, hoặc phe đủ ngưỡng claim nếu đảo chưa chủ) —
  // pha nhạt làm nền popup qua CSS.
  tint?: string;
  scores?: FactionScore[];
  pinned?: boolean;
  onTogglePin?: () => void;
  playerHighlight?: {
    faction: string;
    score: number;
  };
}

export function NodeStats({
  nodeId,
  claimThreshold,
  hasOwner,
  tint,
  scores,
  pinned,
  onTogglePin,
  playerHighlight,
}: NodeStatsProps) {
  if (!scores) return null;
  const total = scores.reduce((sum, faction) => sum + faction.score, 0);
  const topScore = scores.reduce(
    (max, faction) => Math.max(max, faction.score),
    0
  );
  const displayScore = hasOwner ? total : topScore;
  const scoreTitle = playerHighlight
    ? `${hasOwner ? "Tổng điểm" : "Điểm phe dẫn đầu"}: ${displayScore > 0 ? compact(displayScore) : 0}${
        playerHighlight.score > 0
          ? ` (Đóng góp: ${compact(playerHighlight.score)})`
          : ""
      }`
    : hasOwner
      ? "Tổng điểm tại cứ điểm"
      : "Điểm của phe cao nhất";

  return (
    <div
      className={`${styles.nodeStats} ${
        tint ? (hasOwner ? styles.tinted : styles.claimable) : ""
      } ${pinned ? styles.pinned : ""}`}
      style={tint ? ({ "--tint": tint } as React.CSSProperties) : undefined}
    >
      <div className={styles.statTitle}>
        <span className={styles.statScore} title={scoreTitle}>
          {displayScore > 0 ? compact(displayScore) : 0}
        </span>
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
      <FactionScoreBars
        scores={scores}
        total={total}
        playerHighlight={playerHighlight}
      />
    </div>
  );
}
