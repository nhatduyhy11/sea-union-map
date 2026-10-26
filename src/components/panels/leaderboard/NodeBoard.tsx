import { ChevronRight } from "lucide-react";
import { compact, number } from "../../../utils/format";
import { useFocusIslandOnBoard } from "../../../hooks/useFocusIsland";
import styles from "./shared.module.css";
import type { FactionScore, NodeBoardEntry } from "../../../types";

// Tab Cứ điểm: mở expand của một đảo = focus đảo trên map (camera pan +
// selected), panel giữ nguyên ở bảng. Focus chỉ xảy ra khi toggle mở; đa mở
// được — camera theo lần expand cuối. Không phụ thuộc Filter mode.
export function NodeBoard({ nodes }: { nodes: NodeBoardEntry[] }) {
  const focusIslandOnBoard = useFocusIslandOnBoard();
  return (
    <>
      <h2>Xếp hạng cứ điểm</h2>
      <p>Mở một cứ điểm để nhìn nó trên map; xếp theo tổng Điểm ST.</p>
      {nodes.map((entry, index) => (
        <details
          key={entry.island.id}
          className={styles.item}
          onToggle={(event) => {
            if ((event.target as HTMLDetailsElement).open)
              focusIslandOnBoard(entry.island.id);
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
          </div>
        </details>
      ))}
    </>
  );
}

function FactionScoreRow({ score }: { score: FactionScore }) {
  return (
    <div className={styles.guildRow}>
      <span style={{ color: score.color }}>{score.name}</span>
      <b>{number(score.score)}</b>
    </div>
  );
}
