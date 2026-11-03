import { useMemo } from "react";
import { Castle, Pin, X } from "lucide-react";
import { factionIslandStats, rankFactions } from "../../../domain/selectors";
import { useMapData } from "../../../stores/dataset";
import { compact } from "../../../utils/format";
import { getFactionIcon } from "../../shared/factionIcons";
import {
  FactionFlag,
  FactionLines,
  ScoreCol,
} from "../../shared/FactionSummary";
import detail from "../NodeDetails/NodeDetails.module.css";
import styles from "./BaseDetails.module.css";
import { ScoreDotPlot } from "./ScoreDotPlot";
import type { Island, IslandBucketStats } from "../../../types";

export interface BaseDetailsProps {
  island: Island;
  pinned: boolean;
  onClose: () => void;
  onTogglePin: (id: string) => void;
}

// Chi tiết căn cứ = thống kê phe sở hữu căn cứ: tóm tắt như BXH Phe + điểm
// phe dồn vào từng tập đảo (chiếm / đủ điểm chưa chiếm / chưa đủ điểm).
export function BaseDetails({
  island,
  pinned,
  onClose,
  onTogglePin,
}: BaseDetailsProps) {
  const { factionBoard, ownedIslands, scoresByNode } = useMapData();
  const factionId = island.owner ?? island.id;
  const entry = factionBoard.find((faction) => faction.id === factionId);
  const rank = useMemo(
    () => rankFactions(factionBoard).get(factionId),
    [factionBoard, factionId]
  );
  const stats = useMemo(
    () => factionIslandStats(factionId, ownedIslands, scoresByNode),
    [factionId, ownedIslands, scoresByNode]
  );
  const FactionIcon = getFactionIcon(factionId) ?? Castle;
  return (
    <div className={detail.detail}>
      <div className={detail.detailTop}>
        <span className={detail.eyebrow}>THÔNG TIN CĂN CỨ PHE</span>
        <button aria-label="Đóng chi tiết" onClick={onClose}>
          <X size={17} />
        </button>
      </div>
      <div
        className={detail.detailIcon}
        style={{ color: entry?.color || "#b8c6cf" }}
      >
        <FactionIcon size={33} />
      </div>
      <h2 className={detail.title}>{island.name}</h2>
      {entry && (
        <div className={styles.card} style={{ borderColor: entry.color }}>
          <span className={styles.rank} title="Hạng theo điểm phe">
            {rank}
          </span>
          <FactionFlag entry={entry} />
          <FactionLines entry={entry} />
          <ScoreCol entry={entry} />
        </div>
      )}
      <div className={detail.sectionTitle}>
        Điểm phe trên các đảo<span>tổng / trung bình / trung vị</span>
      </div>
      <table
        className={styles.stats}
        style={{ "--tint": entry?.color } as React.CSSProperties}
      >
        <thead>
          <tr>
            <th />
            <th>Đảo</th>
            <th>Tổng</th>
            <th>avg</th>
            <th>median</th>
          </tr>
        </thead>
        <tbody>
          <StatRow
            label="Đủ điểm, chưa chiếm"
            hint="Có điểm ≥ ngưỡng claim nhưng phe không sở hữu (bị outbid hoặc mất đường nối)"
            stats={stats.claimable}
          />
          <StatRow
            label="Đang chiếm"
            hint="Đảo phe đang sở hữu"
            stats={stats.owned}
          />
          <StatRow
            className={`${styles.tinted} ${styles.sum}`}
            label="Đủ điểm"
            hint="Đang chiếm + đủ điểm chưa chiếm"
            stats={stats.enough}
          />
          <StatRow
            className={styles.tinted}
            label="Chưa đủ điểm"
            hint="Có điểm nhưng dưới ngưỡng claim, phe không sở hữu"
            stats={stats.below}
          />
          <StatRow
            className={`${styles.total} ${styles.sum}`}
            label="Tất cả"
            hint="Đủ điểm + chưa đủ điểm: mọi đảo phe có điểm hoặc đang chiếm"
            stats={stats.touched}
          />
        </tbody>
      </table>
      {stats.enoughIslands.length > 0 && (
        <>
          <div className={detail.sectionTitle}>
            Phân bố điểm đảo đủ điểm<span>mỗi chấm một đảo, trục log</span>
          </div>
          <ScoreDotPlot
            islands={stats.enoughIslands}
            stats={stats.enough}
            color={entry?.color || "#5b7a8c"}
          />
        </>
      )}
      <button
        className={`${detail.pinDetail} ${pinned ? detail.isPinned : ""}`}
        onClick={() => onTogglePin(island.id)}
      >
        <Pin size={15} />
        {pinned ? "Bỏ ghim tóm tắt trên map" : "Ghim tóm tắt trên map"}
      </button>
    </div>
  );
}

function StatRow({
  className,
  label,
  hint,
  stats,
}: {
  className?: string;
  label: string;
  hint: string;
  stats: IslandBucketStats;
}) {
  const value = (points: number) => (stats.count ? compact(points) : "—");
  return (
    <tr className={className} title={hint}>
      <th scope="row">{label}</th>
      <td>{stats.count}</td>
      <td>{value(stats.total)}</td>
      <td>{value(stats.mean)}</td>
      <td>{value(stats.median)}</td>
    </tr>
  );
}
