import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { compact, number } from "../../../utils/format";
import { useFocusIslandOnBoard } from "../../../hooks/useFocusIsland";
import { useSelection } from "../../../stores/selection";
import { PlayerTable } from "../NodeDetails/PlayerTable";
import { tintStyle } from "./tint";
import styles from "./shared.module.css";
import type { Faction, FactionScore, NodeBoardEntry } from "../../../types";

// Tab Cứ điểm: mở expand của một đảo = focus đảo trên map (camera pan +
// selected), panel giữ nguyên ở bảng. Focus chỉ xảy ra khi toggle mở; đa mở
// được — camera theo lần expand cuối. Đóng expand của đảo đang selected thì
// gỡ selection (viền active) — đảo khác đang chọn thì giữ nguyên.
// Không phụ thuộc Filter mode. Mặc định theo id đảo (1-1, 1-2 …); checkbox
// bật thì sort theo tổng Điểm ST. Pill phe lọc đảo theo phe đang chiếm; tiêu
// đề đếm số cứ điểm đang hiển thị. State local, rời board là reset.
export function NodeBoard({
  nodes,
  factions,
}: {
  nodes: NodeBoardEntry[];
  factions: Faction[];
}) {
  const focusIslandOnBoard = useFocusIslandOnBoard();
  const selected = useSelection((state) => state.selected);
  const [sortByScore, setSortByScore] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
  const displayNodes = useMemo(() => {
    const owned = ownerFilter
      ? nodes.filter((entry) => entry.owner?.id === ownerFilter)
      : nodes;
    return sortByScore ? [...owned].sort((a, b) => b.total - a.total) : owned;
  }, [nodes, sortByScore, ownerFilter]);
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
      <div className={styles.sortBar}>
        <label
          className={styles.sortOption}
          title="Bật: sắp xếp theo tổng Điểm ST. Tắt: theo số đảo (1-1, 1-2 …)."
        >
          <input
            type="checkbox"
            checked={sortByScore}
            onChange={(event) => setSortByScore(event.target.checked)}
          />
          Sắp xếp theo điểm
        </label>
      </div>
      {displayNodes.map((entry, index) => (
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
                {entry.total > 0 ? (
                  <>
                    {entry.scores.filter((s) => s.score > 0).length} phe
                    <TopShare entry={entry} />
                  </>
                ) : (
                  "chưa có điểm"
                )}
              </small>
            </div>
            <b>{compact(entry.total)}</b>
            <ChevronRight size={13} />
          </summary>
          <div className={styles.allocation}>
            {entry.scores
              .filter((score) => score.score > 0)
              .map((score) => (
                <FactionScoreRow key={score.id} score={score} />
              ))}
            {entry.attackers.length > 0 && (
              <div className={styles.playerBlock}>
                <PlayerTable attackers={entry.attackers} />
              </div>
            )}
          </div>
        </details>
      ))}
    </>
  );
}

// Điểm phe góp cao nhất (màu label phe đó) + % so với tổng điểm đảo, làm tròn
// xuống số nguyên.
function TopShare({ entry }: { entry: NodeBoardEntry }) {
  const top = entry.scores.reduce((best, score) =>
    score.score > best.score ? score : best
  );
  return (
    <>
      {" · "}
      <span className={styles.topShare} style={{ color: top.labelColor }}>
        {compact(top.score)} ({Math.floor((top.score / entry.total) * 100)}%)
      </span>
    </>
  );
}

function FactionScoreRow({ score }: { score: FactionScore }) {
  return (
    <div className={styles.guildRow}>
      <span style={{ color: score.labelColor }}>{score.name}</span>
      <b>{number(score.score)}</b>
    </div>
  );
}
