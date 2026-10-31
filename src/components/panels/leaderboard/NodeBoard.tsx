import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  Swords,
} from "lucide-react";
import { compact } from "../../../utils/format";
import { FactionScoreBars } from "../../shared/FactionScoreBars";
import { useFocusIslandOnBoard } from "../../../hooks/useFocusIsland";
import { useSelection } from "../../../stores/selection";
import { PlayerTable } from "../NodeDetails/PlayerTable";
import { tintStyle } from "./tint";
import styles from "./shared.module.css";
import type { Frontline } from "../../../domain/selectors";
import type { Faction, FactionScore, NodeBoardEntry } from "../../../types";

// Tab Cứ điểm: mở expand của một đảo = focus đảo trên map (camera pan +
// selected), panel giữ nguyên ở bảng. Focus chỉ xảy ra khi toggle mở; đa mở
// được — camera theo lần expand cuối. Đóng expand của đảo đang selected thì
// gỡ selection (viền active) — đảo khác đang chọn thì giữ nguyên.
// Không phụ thuộc Filter mode. Mặc định theo id đảo (1-1, 1-2 …); nút sort
// xoay vòng giảm dần → tăng dần → không sort theo tổng Điểm ST. Pill phe lọc đảo theo phe đang chiếm,
// "Tranh chấp" = đảo giao tranh (frontlineNodes), "Chưa chiếm" = đảo trung
// lập — đều theo owner server (đã áp rule ngắt đường); row tranh chấp hiện
// icon kiếm trước tổng điểm, cùng màu chocolate với canvas; tiêu đề đếm số
// cứ điểm đang hiển thị. State local, rời board là reset.
export function NodeBoard({
  nodes,
  factions,
  frontlineByNode,
}: {
  nodes: NodeBoardEntry[];
  factions: Faction[];
  frontlineByNode: Map<string, Frontline>;
}) {
  const focusIslandOnBoard = useFocusIslandOnBoard();
  const selected = useSelection((state) => state.selected);
  const [scoreSort, setScoreSort] = useState<ScoreSort>("none");
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
  const displayNodes = useMemo(() => {
    const owned =
      ownerFilter === UNCLAIMED
        ? nodes.filter((entry) => !entry.owner)
        : ownerFilter === CONTESTED
          ? nodes.filter((entry) => frontlineByNode.has(entry.island.id))
          : ownerFilter
            ? nodes.filter((entry) => entry.owner?.id === ownerFilter)
            : nodes;
    if (scoreSort === "none") return owned;
    const sign = scoreSort === "asc" ? 1 : -1;
    return [...owned].sort((a, b) => sign * (a.total - b.total));
  }, [nodes, scoreSort, ownerFilter, frontlineByNode]);
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
        <button
          className={ownerFilter === CONTESTED ? styles.selected : ""}
          onClick={() =>
            setOwnerFilter(ownerFilter === CONTESTED ? null : CONTESTED)
          }
        >
          Tranh chấp
        </button>
        <button
          className={ownerFilter === UNCLAIMED ? styles.selected : ""}
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
              {frontlineByNode.has(entry.island.id) && (
                <Swords size={11} className={styles.frontlineIcon} />
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

// Giá trị filter riêng cho pill "Tranh chấp" (đảo giao tranh) và
// "Chưa chiếm" (đảo trung lập, chưa phe nào chiếm).
const CONTESTED = "__contested";
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

