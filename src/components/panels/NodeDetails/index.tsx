import { Anchor, Castle, Pin, Shield, X } from "lucide-react";
import { number } from "../../../utils/format";
import { FactionScores } from "./FactionScores";
import { PlayerTable } from "./PlayerTable";
import styles from "./NodeDetails.module.css";
import type { FactionScore, NodeDetailData } from "../../../types";

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
  // Leading faction for the claim: highest score among factions still linked
  // to their base — a suspended top scorer yields to the next one.
  const leader = scores.reduce<FactionScore | undefined>(
    (best, faction) =>
      faction.connected !== false &&
      faction.score > 0 &&
      (!best || faction.score > best.score)
        ? faction
        : best,
    undefined
  );
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
        {island.base ? <Castle size={33} /> : <Anchor size={33} />}
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
            {island.base ? "CĂN CỨ PHE" : "ĐIỂM CHIẾM ĐÓNG TỐI THIỂU"}
          </small>
          {island.base ? (
            <b>Không thể bị chiếm</b>
          ) : (
            <b style={{ color: leader?.labelColor }}>
              {number(island.claimThreshold)}
              {leader && ` (${number(leader.score)})`}
            </b>
          )}
        </div>
      </div>
      {!island.base && (
        <>
          <div className={styles.sectionTitle}>
            Điểm các phe<span>{number(total)} tổng</span>
          </div>
          <FactionScores scores={scores} total={total} />
          <div className={styles.sectionTitle}>
            Người chơi tấn công<span>{attackers.length} người</span>
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
