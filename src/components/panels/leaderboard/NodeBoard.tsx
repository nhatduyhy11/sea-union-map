import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BicepsFlexed,
  ChevronRight,
  Gift,
  Swords,
  type LucideIcon,
} from "lucide-react";
import { compact } from "../../../utils/format";
import { FactionScoreBars } from "../../shared/FactionScoreBars";
import { useFocusIslandOnBoard } from "../../../hooks/useFocusIsland";
import { useSelection } from "../../../stores/selection";
import { PlayerTable } from "../NodeDetails/PlayerTable";
import { tintStyle } from "./tint";
import styles from "./shared.module.css";
import type {
  CanvasIcon,
  Faction,
  FactionScore,
  NodeBoardEntry,
} from "../../../types";

const BOARD_STATUS_ICONS: Partial<
  Record<CanvasIcon, { Icon: LucideIcon; label: string }>
> = {
  frontline: { Icon: Swords, label: "Tranh" },
  gifted: { Icon: Gift, label: "Cướp" },
  overbuilt: { Icon: BicepsFlexed, label: "Dồn" },
};

// Tab Cứ điểm: mở expand của một đảo = focus đảo trên map (camera pan +
// selected), panel giữ nguyên ở bảng. Focus chỉ xảy ra khi toggle mở; đa mở
// được — camera theo lần expand cuối. Đóng expand của đảo đang selected thì
// gỡ selection (viền active) — đảo khác đang chọn thì giữ nguyên.
// Không phụ thuộc Filter mode. Mặc định theo id đảo (1-1, 1-2 …); nút sort
// xoay vòng giảm dần → tăng dần → không sort theo tổng Điểm ST. Pill phe lọc đảo theo phe đang chiếm,
// "Tranh chấp" = đảo giao tranh (frontlineNodes), "Chưa chiếm" = đảo trung
// lập — đều theo owner server (đã áp rule ngắt đường); row tranh chấp hiện
// icon kiếm/gift/biceps trước tổng điểm, theo trạng thái icon canvas; tiêu đề đếm số
// cứ điểm đang hiển thị. State local, rời board là reset.
export function NodeBoard({
  nodes,
  factions,
  canvasIconByNode,
}: {
  nodes: NodeBoardEntry[];
  factions: Faction[];
  canvasIconByNode: ReadonlyMap<string, CanvasIcon>;
}) {
  const focusIslandOnBoard = useFocusIslandOnBoard();
  const selected = useSelection((state) => state.selected);
  const [scoreSort, setScoreSort] = useState<ScoreSort>("none");
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
  const displayNodes = useMemo(() => {
    const statusFilter = STATUS_FILTERS.find(
      (filter) => filter.id === ownerFilter
    );
    const owned = nodes.filter((entry) => {
      if (ownerFilter === UNCLAIMED) return !entry.owner;
      if (statusFilter)
        return canvasIconByNode.get(entry.island.id) === statusFilter.status;
      return !ownerFilter || entry.owner?.id === ownerFilter;
    });
    if (scoreSort === "none") return owned;
    const sign = scoreSort === "asc" ? 1 : -1;
    return [...owned].sort((a, b) => sign * (a.total - b.total));
  }, [nodes, scoreSort, ownerFilter, canvasIconByNode]);
  return (
    <>
      <h2>Xếp hạng cứ điểm ({displayNodes.length})</h2>
      <div className={styles.subTabs}>
        <button
          className={ownerFilter ? "" : styles.selected}
          onClick={() => setOwnerFilter(null)}
        >
          Tất cả
        </button>
        {factions.map((faction) => (
          <button
            key={faction.id}
            className={`${styles.factionPill} ${ownerFilter === faction.id ? styles.selected : ""}`}
            style={{ "--label": faction.labelColor } as React.CSSProperties}
            onClick={() =>
              setOwnerFilter(ownerFilter === faction.id ? null : faction.id)
            }
          >
            {faction.name}
          </button>
        ))}
      </div>
      <div className={`${styles.subTabs} ${styles.nodeFilters}`}>
        {STATUS_FILTERS.map(({ id, status }) => {
          const { Icon, label } = BOARD_STATUS_ICONS[status]!;
          return (
            <button
              key={id}
              className={ownerFilter === id ? styles.selected : ""}
              aria-pressed={ownerFilter === id}
              onClick={() => setOwnerFilter(ownerFilter === id ? null : id)}
            >
              <Icon size={13} aria-hidden="true" />
              {label}
            </button>
          );
        })}
        <button
          className={ownerFilter === UNCLAIMED ? styles.selected : ""}
          aria-pressed={ownerFilter === UNCLAIMED}
          onClick={() =>
            setOwnerFilter(ownerFilter === UNCLAIMED ? null : UNCLAIMED)
          }
        >
          Chưa chiếm
        </button>
      </div>
      <div className={styles.sortBar}>
        <button
          className={`${styles.sortOption} ${scoreSort !== "none" ? styles.sortActive : ""}`}
          title="Bấm để đổi: giảm dần → tăng dần → không sort (theo số đảo 1-1, 1-2 …)."
          onClick={() => setScoreSort(NEXT_SORT[scoreSort])}
        >
          {scoreSort === "asc" ? (
            <ArrowUp size={11} />
          ) : scoreSort === "desc" ? (
            <ArrowDown size={11} />
          ) : (
            <ArrowUpDown size={11} />
          )}
          Sắp xếp theo điểm
          {scoreSort === "asc" && " (tăng dần)"}
          {scoreSort === "desc" && " (giảm dần)"}
        </button>
      </div>
      {displayNodes.map((entry, index) => {
        const claimed = Boolean(entry.owner);
        const canvasIcon = canvasIconByNode.get(entry.island.id);
        const status = BOARD_STATUS_ICONS[canvasIcon ?? "plain"];
        const StatusIcon = status?.Icon;
        return (
          <details
            key={entry.island.id}
            className={styles.item}
            onToggle={(event) => {
              if ((event.target as HTMLDetailsElement).open)
                focusIslandOnBoard(entry.island.id);
              else if (selected === entry.island.id)
                useSelection.getState().close();
            }}
          >
            <summary
              className={`${styles.summary} ${styles.tintedSummary}`}
              style={tintStyle(entry.owner?.color)}
            >
              <span className={styles.rank}>{index + 1}</span>
              <div className={styles.factionName}>
                {entry.island.id} {entry.island.name}
                <small>
                  {entry.scores.filter((s) => s.score > 0).length} phe
                  {entry.total > 0 ? (
                    <TopShare entry={entry} claimed={claimed} />
                  ) : (
                    <ClaimNeed entry={entry} />
                  )}
                </small>
              </div>
              {StatusIcon && (
                <StatusIcon
                  size={16}
                  className={styles.nodeStatusIcon}
                  style={{
                    color:
                      canvasIcon === "frontline"
                        ? "#d2691e"
                        : entry.owner?.color,
                  }}
                  role="img"
                  aria-label={status.label}
                />
              )}
              <b>{compact(entry.total)}</b>
              <ChevronRight size={13} />
            </summary>
            <div className={styles.allocation}>
              <FactionScoreBars
                scores={entry.scores}
                total={entry.total}
                hideEmpty
              />
              {entry.attackers.length > 0 && (
                <div className={styles.playerBlock}>
                  <PlayerTable attackers={entry.attackers} />
                </div>
              )}
            </div>
          </details>
        );
      })}
    </>
  );
}

function topScore(entry: NodeBoardEntry): FactionScore {
  return entry.scores.reduce((best, score) =>
    score.score > best.score ? score : best
  );
}

type ScoreSort = "none" | "asc" | "desc";
const NEXT_SORT: Record<ScoreSort, ScoreSort> = {
  none: "desc",
  desc: "asc",
  asc: "none",
};

// Filter trạng thái dùng cùng kết quả phân loại icon với canvas.
const STATUS_FILTERS = [
  { id: "__contested", status: "frontline" },
  { id: "__overbuilt", status: "overbuilt" },
  { id: "__gifted", status: "gifted" },
] as const;
const UNCLAIMED = "__unclaimed";

// Điểm phe góp cao nhất (màu label phe đó) + % so với tổng điểm đảo, làm
// tròn xuống số nguyên. Đảo trung lập thì nối thêm "/ điểm cần claim".
function TopShare({
  entry,
  claimed,
}: {
  entry: NodeBoardEntry;
  claimed: boolean;
}) {
  const top = topScore(entry);
  return (
    <>
      {" · "}
      <span className={styles.topShare} style={{ color: top.labelColor }}>
        {compact(top.score)} ({Math.floor((top.score / entry.total) * 100)}%)
      </span>
      {!claimed && <ClaimNeed entry={entry} />}
    </>
  );
}

// "/ điểm cần claim" — chữ đen, không theo màu phe.
function ClaimNeed({ entry }: { entry: NodeBoardEntry }) {
  return (
    <span className={styles.topShare} style={{ color: "#000" }}>
      {" / "}
      {compact(entry.island.claimThreshold)}
    </span>
  );
}
