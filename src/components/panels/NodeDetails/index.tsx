import type { CSSProperties } from "react";
import { Anchor, Pin, Shield, X } from "lucide-react";
import { bossImageUrl, bossName } from "../../../data/nodeBosses";
import { number } from "../../../utils/format";
import { FactionScoreBars } from "../../shared/faction/FactionScoreBars";
import { PlayerTable } from "./PlayerTable";
import styles from "./NodeDetails.module.css";
import type { NodeDetailData } from "../../../domain/selectors/nodeDetails";

export interface NodeDetailsProps {
  details: NodeDetailData;
  pinned: boolean;
  onClose: () => void;
  onTogglePin: (id: string) => void;
}

export function NodeDetails({
  details,
  pinned,
  onClose,
  onTogglePin,
}: NodeDetailsProps) {
  const { island, owner, scores, total, attackers } = details;
  // Owner là truth server (đã áp rule ngắt đường) — hiện điểm của owner cạnh
  // ngưỡng chiếm; node trung lập chỉ hiện ngưỡng.
  const ownerScore = scores.find((faction) => faction.id === owner?.id);
  // Server cắt bảng người/node ở top-20 — đủ 20 row mà tổng điểm các row chưa
  // sát tổng điểm node (chênh >1%) là còn người ngoài bảng: đếm kèm "(+)".
  // Khi dump thiếu điểm node server, total tự tính từ các row nên luôn khớp.
  const attackerSum = attackers.reduce((sum, entry) => sum + entry.score, 0);
  const attackersTruncated =
    attackers.length === ATTACKER_CAP &&
    total > 0 &&
    Math.abs(attackerSum - total) / total > 0.01;
  // Căn cứ phe render BaseDetails (Sidebar) — ở đây luôn là đảo thường.
  const bossId = island.monsterId;
  const bossImage = bossId ? bossImageUrl(bossId) : undefined;
  return (
    <div
      className={`${styles.detail} ${bossImage ? styles.hasBoss : ""}`}
      style={
        bossImage
          ? ({
              "--boss-bg": `url(${bossImage})`,
            } as CSSProperties)
          : undefined
      }
    >
      <div className={styles.detailTop}>
        <span className={styles.eyebrow}>THÔNG TIN CỨ ĐIỂM</span>
        <button aria-label="Đóng chi tiết" onClick={onClose}>
          <X size={17} />
        </button>
      </div>
      <div
        className={styles.detailIcon}
        style={{ color: owner?.color || "#b8c6cf" }}
      >
        <Anchor size={33} />
      </div>
      <h2 className={styles.title}>{island.name}</h2>
      <div className={styles.detailTags}>
        <span
          style={
            owner
              ? {
                  background: owner.color,
                  borderColor: owner.color,
                  color: "#1b2329",
                }
              : undefined
          }
        >
          #{island.id}
        </span>
        {bossId && <span>{bossName(bossId)}</span>}
      </div>
      <div className={styles.claim}>
        <Shield size={19} />
        <div>
          <small>ĐIỂM CẦN / ĐIỂM PHE CHIẾM</small>
          <b style={{ color: ownerScore?.labelColor }}>
            {number(island.claimThreshold)}
            {ownerScore && ` / ${number(ownerScore.score)}`}
          </b>
        </div>
      </div>
      <div className={styles.sectionTitle}>
        Điểm các phe<span>{number(total)} tổng</span>
      </div>
      <FactionScoreBars scores={scores} total={total} />
      <div className={styles.sectionTitle}>
        Người chơi tấn công
        <span>
          {attackers.length}
          {attackersTruncated && "(+)"} người
        </span>
      </div>
      <PlayerTable attackers={attackers} />
      <button
        className={`${styles.pinDetail} ${pinned ? styles.isPinned : ""}`}
        onClick={() => onTogglePin(island.id)}
      >
        <Pin size={15} />
        {pinned ? "Bỏ ghim điểm trên map" : "Ghim điểm trên map"}
      </button>
    </div>
  );
}

// Server trả tối đa 20 người/node (bảng người bị cắt ở 20 row).
const ATTACKER_CAP = 20;
