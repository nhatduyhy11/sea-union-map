import { useEffect, useMemo, type CSSProperties } from "react";
import { Pin, X } from "lucide-react";
import { factionFlagUrl } from "../../../data/factionFlags";
import { factionIslandStats, rankFactions } from "../../../domain/selectors";
import { useDataset, useMapData } from "../../../stores/dataset";
import { useSelection } from "../../../stores/selection";
import { useFocusIsland } from "../../../hooks/useFocusIsland";
import {
  FactionFlag,
  FactionLines,
  ScoreCol,
} from "../../shared/faction/FactionSummary";
import detail from "../NodeDetails/NodeDetails.module.css";
import styles from "./BaseDetails.module.css";
import background from "../../shared/faction/FactionBackground.module.css";
import { InfoHint } from "../../shared/InfoHint";
import { BaseCarousel } from "./components/BaseCarousel";
import { FactionStatsTable } from "./components/FactionStatsTable";
import { NodeFilterChips } from "./components/NodeFilterChips";
import { ScoreDotPlot } from "./components/ScoreDotPlot";
import { useBaseFilter } from "./useBaseFilter";
import type { Island } from "../../../types";

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
  const flag = factionFlagUrl(factionId);
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
  const { activeFilter, setActiveFilter, toggleFilter, highlight } =
    useBaseFilter(factionId, stats);
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
      <div
        className={flag ? background.detail : undefined}
        style={
          flag
            ? ({ "--faction-flag": `url(${flag})` } as CSSProperties)
            : undefined
        }
      >
        <h2 className={detail.title}>{island.name}</h2>
        {entry && (
          <div
            className={`${styles.card} ${rank === 1 ? styles.leading : ""}`}
            style={
              {
                borderColor: entry.color,
                "--tint": entry.color,
              } as CSSProperties
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
        <NodeFilterChips
          stats={stats}
          activeFilter={activeFilter}
          onToggle={toggleFilter}
        />
        <div className={detail.sectionTitle}>
          Điểm phe trên các đảo<span>tổng / trung bình / trung vị</span>
        </div>
        <FactionStatsTable
          stats={stats}
          color={entry?.color}
          activeFilter={activeFilter}
          onSelect={setActiveFilter}
          onToggle={toggleFilter}
        />
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
    </div>
  );
}

// Thống kê rỗng cho phe không có trong bộ dữ liệu.
const NO_STATS = factionIslandStats("", [], new Map(), new Map(), new Map());
