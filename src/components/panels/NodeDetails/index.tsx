import { Anchor, Castle, Pin, Shield, X } from "lucide-react";
import { number } from "../../../utils/format";
import { FactionScoreBars } from "../../shared/FactionScoreBars";
import { getFactionIcon } from "../../shared/factionIcons";
import { PlayerTable } from "./PlayerTable";
import styles from "./NodeDetails.module.css";
import type { NodeDetailData } from "../../../types";

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
  return (
    <div className={styles.detail}>
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
        {island.base ? (
          (() => {
            const FactionIcon = getFactionIcon(island.owner || island.id);
            return FactionIcon ? <FactionIcon size={33} /> : <Castle size={33} />;
          })()
        ) : (
          <Anchor size={33} />
        )}
      </div>
      <h2 className={styles.title}>{island.name}</h2>
      <div className={styles.detailTags}>
        <span>#{island.id}</span>
        <span style={{ color: owner?.labelColor }}>
          {owner?.name || "Trung lập"}
        </span>
      </div>
      <div className={styles.claim}>
        <Shield size={19} />
        <div>
          <small>
            {island.base ? "CĂN CỨ PHE" : "ĐIỂM CẦN / ĐIỂM PHE CHIẾM"}
          </small>
          {island.base ? (
            <b>Không thể bị chiếm</b>
          ) : (
            <b style={{ color: ownerScore?.labelColor }}>
              {number(island.claimThreshold)}
              {ownerScore && ` / ${number(ownerScore.score)}`}
            </b>
          )}
        </div>
      </div>
      {!island.base && (
        <>
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
        </>
      )}
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
