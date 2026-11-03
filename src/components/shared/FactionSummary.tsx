import { Fuel, HandFist } from "lucide-react";
import { compact } from "../../utils/format";
import { getFactionIcon } from "./factionIcons";
import styles from "./FactionSummary.module.css";
import type { FactionBoardEntry } from "../../types";

// Khối tóm tắt phe của BXH Phe (cờ / tên + ba tập đảo / cột điểm) — dùng lại
// ở popover căn cứ trên canvas và header chi tiết căn cứ.

export function FactionFlag({ entry }: { entry: FactionBoardEntry }) {
  const Icon = getFactionIcon(entry.id);
  return (
    <span
      className={styles.flag}
      style={{
        color: entry.labelColor,
        background: `${entry.labelColor}18`,
      }}
    >
      {Icon ? <Icon size={16} /> : entry.name[0]}
    </span>
  );
}

// Tên phe, guild/LC và ba tập đảo: owned / claimable / touched.
export function FactionLines({ entry }: { entry: FactionBoardEntry }) {
  return (
    <div className={styles.name} style={{ color: entry.labelColor }}>
      {entry.name}
      <small>
        {entry.guilds.length} guild |{" "}
        <span className={styles.power}>
          <HandFist size={9} />
          {entry.power ? compact(entry.power) : "—"}
        </span>
      </small>
      <span className={styles.islandStats}>
        <span title="Số đảo phe đang sở hữu">
          <span className={styles.statLabel}>Đảo chiếm</span>
          <span className={styles.statValue}>{entry.islands}</span>
        </span>
        <span title="Có điểm và đủ ngưỡng claim, không xét đường nối">
          <span className={styles.statLabel}>Đủ điểm</span>
          <span className={styles.statValue}>{entry.claimable}</span>
        </span>
        <span title="Mọi đảo phe có điểm, gồm cả đảo đang chiếm có điểm">
          <span className={styles.statLabel}>Đánh</span>
          <span className={styles.statValue}>{entry.touched}</span>
        </span>
      </span>
    </div>
  );
}

// Cột phải: tổng điểm phe, Tổng Nhiên Liệu xếp ngay dưới (ẩn khi dump thiếu
// fuel — data cũ).
export function ScoreCol({ entry }: { entry: FactionBoardEntry }) {
  return (
    <span className={styles.scoreCol}>
      <b>{compact(entry.score)}</b>
      {entry.fuel != null && (
        <small title="Tổng Nhiên Liệu">
          <Fuel size={9} />
          {compact(entry.fuel)}
        </small>
      )}
    </span>
  );
}
