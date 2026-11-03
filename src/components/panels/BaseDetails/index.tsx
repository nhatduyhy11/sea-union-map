import { useEffect, useId, useMemo, useState } from "react";
import { BicepsFlexed, Pin, Swords, X, type LucideIcon } from "lucide-react";
import {
  factionFilterIds,
  factionIslandStats,
  rankFactions,
  type FactionNodeFilter,
} from "../../../domain/selectors";
import { useDataset, useMapData } from "../../../stores/dataset";
import { useSelection } from "../../../stores/selection";
import { useFocusIsland } from "../../../hooks/useFocusIsland";
import { useMapView } from "../../../stores/mapView";
import { compact } from "../../../utils/format";
import {
  FactionFlag,
  FactionLines,
  ScoreCol,
} from "../../shared/FactionSummary";
import detail from "../NodeDetails/NodeDetails.module.css";
import board from "../leaderboard/shared.module.css";
import styles from "./BaseDetails.module.css";
import { InfoHint } from "../../shared/InfoHint";
import { BaseCarousel } from "./BaseCarousel";
import { ScoreDotPlot } from "./ScoreDotPlot";
import type { Island, IslandBucket, IslandBucketStats } from "../../../types";

export interface BaseDetailsProps {
  island: Island;
  pinned: boolean;
  // Không truyền = căn cứ mặc định của tab (chưa chọn đảo): ẩn nút đóng.
  onClose?: () => void;
  onTogglePin: (id: string) => void;
}

// Chi tiết căn cứ = thống kê phe sở hữu căn cứ: tóm tắt như BXH Phe + điểm
// phe dồn vào từng tập đảo (chiếm / mất / chưa đủ điểm).
export function BaseDetails({
  island,
  pinned,
  onClose,
  onTogglePin,
}: BaseDetailsProps) {
  const { factionBoard, islandStatsByFaction } = useMapData();
  const factionId = island.owner ?? island.id;
  const server = useDataset((state) => state.server);
  // Căn cứ người dùng chọn (có onClose) được nhớ theo cụm để đóng chi tiết đảo
  // thì quay về đúng căn cứ. Căn cứ mặc định không ghi, để vẫn bám phe top 1.
  const chosen = Boolean(onClose);
  useEffect(() => {
    if (chosen) useSelection.getState().rememberBase(server, factionId);
  }, [chosen, server, factionId]);
  const entry = factionBoard.find((faction) => faction.id === factionId);
  const rank = useMemo(
    () => rankFactions(factionBoard).get(factionId),
    [factionBoard, factionId]
  );
  const stats = islandStatsByFaction.get(factionId) ?? NO_STATS;
  const focusIsland = useFocusIsland();
  const [activeFilter, setActiveFilter] = useState<FactionNodeFilter | null>(
    null
  );
  // Đổi căn cứ thì bỏ filter của căn cứ cũ.
  useEffect(() => setActiveFilter(null), [factionId]);
  const highlight = activeFilter ? factionFilterIds(stats, activeFilter) : null;
  const toggleFilter = (id: FactionNodeFilter) =>
    setActiveFilter(activeFilter === id ? null : id);
  const radioName = useId();
  // Filter đang bật = highlight các đảo đó trên map; rời panel thì gỡ.
  useEffect(() => {
    useMapView.getState().setNodeHighlight(highlight);
  }, [highlight]);
  useEffect(() => () => useMapView.getState().setNodeHighlight(null), []);
  return (
    <div className={detail.detail}>
      <div className={detail.detailTop}>
        <span className={detail.eyebrow}>
          THÔNG TIN CĂN CỨ PHE
          <InfoHint>
            <p>
              Mọi số đếm đảo ở đây (Đảo chiếm, Đủ điểm, filter và bảng "Điểm phe
              trên các đảo") đều không tính căn cứ phe.
            </p>
            <p>
              Trong game Đảo chiếm có tính cả căn cứ, nên số trên web thấp hơn
              1.
            </p>
          </InfoHint>
        </span>
        {onClose && (
          <button aria-label="Đóng chi tiết" onClick={onClose}>
            <X size={17} />
          </button>
        )}
      </div>
      <BaseCarousel factionId={factionId} />
      <h2 className={detail.title}>{island.name}</h2>
      {entry && (
        <div
          className={`${styles.card} ${rank === 1 ? styles.leading : ""}`}
          style={
            {
              borderColor: entry.color,
              "--tint": entry.color,
            } as React.CSSProperties
          }
        >
          <span className={styles.rank} title="Hạng theo điểm phe">
            {rank}
          </span>
          <FactionFlag entry={entry} />
          <FactionLines entry={entry} />
          <ScoreCol entry={entry} />
        </div>
      )}
      <div
        className={`${board.subTabs} ${board.nodeFilters} ${styles.filters}`}
      >
        {NODE_FILTERS.map(({ id, Icon, label, hint }) => {
          const count = stats[id].size;
          return (
            <button
              key={id}
              className={activeFilter === id ? board.selected : ""}
              aria-pressed={activeFilter === id}
              title={hint}
              disabled={count === 0}
              onClick={() => toggleFilter(id)}
            >
              <Icon size={13} aria-hidden="true" />
              {label}
              <b className={styles.filterCount}>{count}</b>
            </button>
          );
        })}
      </div>
      <div className={detail.sectionTitle}>
        Điểm phe trên các đảo<span>tổng / trung bình / trung vị</span>
      </div>
      <table
        className={styles.stats}
        style={{ "--tint": entry?.color } as React.CSSProperties}
      >
        <thead>
          <tr>
            <th className={styles.pick}>
              <input
                type="radio"
                name={radioName}
                aria-label="Không lọc đảo"
                title="Không lọc đảo"
                checked={activeFilter === null}
                onChange={() => setActiveFilter(null)}
              />
            </th>
            <th />
            <th>Đảo</th>
            <th>Tổng</th>
            <th>avg</th>
            <th>median</th>
          </tr>
        </thead>
        <tbody>
          {STAT_ROWS.map(({ id, className, label, hint }) => (
            <StatRow
              key={id}
              className={className}
              label={label}
              hint={hint}
              stats={stats[id]}
              radioName={radioName}
              active={activeFilter === id}
              onSelect={() => setActiveFilter(id)}
              onToggle={() => toggleFilter(id)}
            />
          ))}
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
            highlight={highlight}
            onSelect={focusIsland}
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

// Thống kê rỗng cho phe không có trong bộ dữ liệu.
const NO_STATS = factionIslandStats("", [], new Map(), new Map(), new Map());

// Filter theo icon canvas, cùng icon / nhãn với filter trạng thái BXH Cứ điểm
// — chỉ giữ filter có nghĩa khi nhìn từ một phe (Cướp / Vết mô tả cặp
// owner–phe top của đảo, không thuộc riêng phe nào). Filter theo điểm phe là
// các dòng của bảng bên dưới.
const NODE_FILTERS: {
  id: "frontline" | "overbuilt";
  Icon: LucideIcon;
  label: string;
  hint: string;
}[] = [
  {
    id: "frontline",
    Icon: Swords,
    label: "Tranh",
    hint: "Đảo giao tranh mà phe là một bên: đang chiếm và bị phe nhì ép, hoặc là phe nhì ép ngay cửa đảo",
  },
  {
    id: "overbuilt",
    Icon: BicepsFlexed,
    label: "Dồn",
    hint: "Đảo phe đang chiếm với điểm vượt mức trung bình của phe",
  },
];

const STAT_ROWS: {
  id: IslandBucket;
  className?: string;
  label: string;
  hint: string;
}[] = [
  {
    id: "claimable",
    label: "Mất",
    hint: "Đủ điểm, chưa chiếm: có điểm ≥ ngưỡng claim nhưng phe không sở hữu (bị outbid hoặc mất đường nối)",
  },
  { id: "owned", label: "Đang chiếm", hint: "Đảo phe đang sở hữu" },
  {
    id: "enough",
    className: `${styles.tinted} ${styles.sum}`,
    label: "Đủ điểm",
    hint: "Đang chiếm + mất",
  },
  {
    id: "below",
    className: styles.tinted,
    label: "Chưa đủ điểm",
    hint: "Có điểm nhưng dưới ngưỡng claim, phe không sở hữu",
  },
  {
    id: "touched",
    className: `${styles.total} ${styles.sum}`,
    label: "Tất cả",
    hint: "Đủ điểm + chưa đủ điểm: mọi đảo phe có điểm hoặc đang chiếm",
  },
];

// Dòng bảng cũng là filter: click cả dòng (hoặc radio ở cột đầu) chọn tập để
// highlight trên map, click lại dòng đang chọn thì bỏ lọc (radio ở header =
// không lọc). Dòng 0 đảo không chọn được.
function StatRow({
  className,
  label,
  hint,
  stats,
  radioName,
  active,
  onSelect,
  onToggle,
}: {
  className?: string;
  label: string;
  hint: string;
  stats: IslandBucketStats;
  radioName: string;
  active: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const value = (points: number) => (stats.count ? compact(points) : "—");
  const disabled = stats.count === 0;
  return (
    <tr
      className={`${className ?? ""} ${disabled ? "" : styles.pickable} ${active ? styles.active : ""}`}
      title={hint}
      // Click radio chưa chọn: onChange chọn, rồi click nổi lên đây cũng chọn
      // (state lúc render chưa phải dòng này) → không bị bật/tắt hai lần.
      onClick={disabled ? undefined : onToggle}
    >
      <td className={styles.pick}>
        <input
          type="radio"
          name={radioName}
          aria-label={label}
          checked={active}
          disabled={disabled}
          onChange={onSelect}
        />
      </td>
      <th scope="row">{label}</th>
      <td>{stats.count}</td>
      <td>{value(stats.total)}</td>
      <td>{value(stats.mean)}</td>
      <td>{value(stats.median)}</td>
    </tr>
  );
}
