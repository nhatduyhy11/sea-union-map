import { Anchor, Castle, Pin, Shield, X } from "lucide-react";
import { number } from "../../../utils/format";
import { FactionScores } from "./FactionScores";
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
        <span style={{ color: owner?.color }}>
          {owner?.name || "Trung lập"}
        </span>
      </div>
      <div className={styles.boss}>
        <Shield size={19} />
        <div>
          <small>{island.base ? "CĂN CỨ PHE" : "BOSS CỨ ĐIỂM"}</small>
          <b>{island.base ? "Không thể bị chiếm" : island.boss}</b>
        </div>
        {!island.base && <span>Lv. {island.level}</span>}
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
