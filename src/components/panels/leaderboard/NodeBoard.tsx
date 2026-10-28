import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { compact, number } from "../../../utils/format";
import { useFocusIslandOnBoard } from "../../../hooks/useFocusIsland";
import { useSelection } from "../../../stores/selection";
import { PlayerTable } from "../NodeDetails/PlayerTable";
import styles from "./shared.module.css";
import type { FactionScore, NodeBoardEntry } from "../../../types";

// Tab Cứ điểm: mở expand của một đảo = focus đảo trên map (camera pan +
// selected), panel giữ nguyên ở bảng. Focus chỉ xảy ra khi toggle mở; đa mở
// được — camera theo lần expand cuối. Đóng expand của đảo đang selected thì
// gỡ selection (viền active) — đảo khác đang chọn thì giữ nguyên.
// Không phụ thuộc Filter mode. Mặc định theo id đảo (1-1, 1-2 …); checkbox
// bật thì sort theo tổng Điểm ST — state local, rời board là reset.
export function NodeBoard({ nodes }: { nodes: NodeBoardEntry[] }) {
  const focusIslandOnBoard = useFocusIslandOnBoard();
  const selected = useSelection((state) => state.selected);
  const [sortByScore, setSortByScore] = useState(false);
  const displayNodes = useMemo(
    () => (sortByScore ? [...nodes].sort((a, b) => b.total - a.total) : nodes),
    [nodes, sortByScore]
  );
  return (
    <>
      <h2>Xếp hạng cứ điểm</h2>
      <p>Mở một cứ điểm để nhìn nó trên map.</p>
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
          Sort theo Điểm
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
          <summary className={styles.summary}>
            <span className={styles.rank}>{index + 1}</span>
            <div className={styles.factionName}>
              {entry.island.id} {entry.island.name}
              <small>
                {entry.total > 0
                  ? `${entry.scores.filter((s) => s.score > 0).length} phe`
                  : "chưa có điểm"}
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

function FactionScoreRow({ score }: { score: FactionScore }) {
  return (
    <div className={styles.guildRow}>
      <span style={{ color: score.labelColor }}>{score.name}</span>
      <b>{number(score.score)}</b>
    </div>
  );
}
