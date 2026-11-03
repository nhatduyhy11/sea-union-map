import { useEffect, useMemo, useState } from "react";
import { BicepsFlexed, Pin, Swords, X, type LucideIcon } from "lucide-react";
import {
  factionIslandStats,
  factionNodeFilters,
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
import type { Island, IslandBucketStats } from "../../../types";

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
  const {
    factionBoard,
    ownedIslands,
    scoresByNode,
    canvasIconByNode,
    frontlineByNode,
  } = useMapData();
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
  const stats = useMemo(
    () => factionIslandStats(factionId, ownedIslands, scoresByNode),
    [factionId, ownedIslands, scoresByNode]
  );
  const nodeFilters = useMemo(
    () =>
      factionNodeFilters(
        factionId,
        ownedIslands,
        scoresByNode,
        canvasIconByNode,
        frontlineByNode
      ),
    [factionId, ownedIslands, scoresByNode, canvasIconByNode, frontlineByNode]
  );
  const focusIsland = useFocusIsland();
  const [activeFilter, setActiveFilter] = useState<FactionNodeFilter | null>(
    null
  );
  // Đổi căn cứ thì bỏ filter của căn cứ cũ.
  useEffect(() => setActiveFilter(null), [factionId]);
  const highlight = useMemo(
    () => (activeFilter ? new Set(nodeFilters[activeFilter]) : null),
    [activeFilter, nodeFilters]
  );
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
              Mọi số đếm đảo ở đây (Đảo chiếm, Đủ điểm, Đánh và bảng "Điểm phe
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
      <div className={styles.filters}>
        {NODE_FILTER_ROWS.map((row, index) => (
          <div
            key={index}
            className={`${board.subTabs} ${board.nodeFilters} ${styles.filterRow}`}
          >
            {row.map(({ id, Icon, label, hint }) => {
              const count = nodeFilters[id].length;
              return (
                <button
                  key={id}
                  className={activeFilter === id ? board.selected : ""}
                  aria-pressed={activeFilter === id}
                  title={hint}
                  disabled={count === 0}
                  onClick={() =>
                    setActiveFilter(activeFilter === id ? null : id)
                  }
                >
                  {Icon && <Icon size={13} aria-hidden="true" />}
                  {label}
                  <b className={styles.filterCount}>{count}</b>
                </button>
              );
            })}
          </div>
        ))}
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
            <th />
            <th>Đảo</th>
            <th>Tổng</th>
            <th>avg</th>
            <th>median</th>
          </tr>
        </thead>
        <tbody>
          <StatRow
            label="Mất"
            hint="Đủ điểm, chưa chiếm: có điểm ≥ ngưỡng claim nhưng phe không sở hữu (bị outbid hoặc mất đường nối)"
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
            hint="Đang chiếm + mất"
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

interface NodeFilterDef {
  id: FactionNodeFilter;
  Icon?: LucideIcon;
  label: string;
  hint: string;
}

// Dòng 1: cùng icon / nhãn với filter trạng thái BXH Cứ điểm — chỉ giữ filter
// có nghĩa khi nhìn từ một phe (Cướp / Vết mô tả cặp owner–phe top của đảo,
// không thuộc riêng phe nào). Dòng 2: tập đảo theo điểm phe — "Mất" (cùng tập
// dòng "Mất" của bảng) và "Đánh" thay "Chưa chiếm" vì panel đã gắn với một phe.
const NODE_FILTER_ROWS: NodeFilterDef[][] = [
  [
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
  ],
  [
    {
      id: "lost",
      label: "Mất",
      hint: "Đủ điểm, chưa chiếm: có điểm ≥ ngưỡng claim nhưng phe không sở hữu",
    },
    {
      id: "attacked",
      label: "Đánh",
      hint: "Mọi đảo phe có điểm",
    },
  ],
];

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
