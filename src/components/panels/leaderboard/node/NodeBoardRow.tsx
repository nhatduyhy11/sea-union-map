import { ChevronRight } from "lucide-react";
import { compact } from "../../../../utils/format";
import { bossImageUrl } from "../../../../data/nodeBosses";
import { FactionScoreBars } from "../../../shared/FactionScoreBars";
import { isNodeStatus, NODE_STATUS } from "../../../shared/nodeStatus";
import { useSelection } from "../../../../stores/selection";
import { PlayerTable } from "../../NodeDetails/PlayerTable";
import { tintStyle } from "../tint";
import shared from "../shared.module.css";
import styles from "./NodeBoard.module.css";
import type { CanvasIcon } from "../../../../domain/selectors/canvasIcons";
import type { NodeBoardEntry } from "../../../../domain/selectors/board/types";

// Mở expand = focus đảo trên map (camera pan + selected), panel giữ nguyên ở
// bảng; đa mở được — camera theo lần expand cuối. Đóng expand của đảo đang
// selected thì gỡ selection (viền active) — đảo khác đang chọn thì giữ nguyên.
// Row có trạng thái icon canvas hiện icon đó trước tổng điểm.
export function NodeBoardRow({
  entry,
  rank,
  canvasIcon,
  onOpen,
}: {
  entry: NodeBoardEntry;
  rank: number;
  canvasIcon: CanvasIcon | undefined;
  onOpen: (id: string) => void;
}) {
  const { island, owner } = entry;
  const status = isNodeStatus(canvasIcon) ? canvasIcon : undefined;
  const StatusIcon = status && NODE_STATUS[status].Icon;
  // Base không bị đánh nên không có nền boss (giống chi tiết cứ điểm).
  const bossHalf =
    !island.base && island.monsterId
      ? bossImageUrl(island.monsterId, "half")
      : undefined;
  const summaryClass = [
    shared.summary,
    shared.tintedSummary,
    bossHalf && styles.bossSummary,
    island.tier === 4 && styles.centerSummary,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <details
      className={shared.item}
      onToggle={(event) => {
        if ((event.target as HTMLDetailsElement).open) onOpen(island.id);
        else if (useSelection.getState().selected === island.id)
          useSelection.getState().close();
      }}
    >
      <summary
        className={summaryClass}
        style={
          {
            ...tintStyle(owner?.color),
            ...(bossHalf && { "--boss-bg": `url(${bossHalf})` }),
          } as React.CSSProperties
        }
      >
        <span className={`${shared.rank} ${styles.rankCell}`}>{rank}</span>
        <div className={styles.factionName}>
          <span className={styles.nodeTitle}>
            {island.id} {island.name}
          </span>
          <small>
            {entry.scores.filter((s) => s.score > 0).length} phe
            {entry.total > 0 && <TopShare entry={entry} />}
            {(!owner || entry.total === 0) && <ClaimNeed entry={entry} />}
          </small>
        </div>
        {StatusIcon && (
          <StatusIcon
            size={16}
            className={`${styles.nodeStatusIcon} ${status === "frontline" ? styles.frontlineIcon : ""}`}
            style={status === "frontline" ? undefined : { color: owner?.color }}
            role="img"
            aria-label={NODE_STATUS[status].label}
          />
        )}
        <b>{compact(entry.total)}</b>
        <ChevronRight size={13} />
      </summary>
      <div className={`${shared.allocation} ${styles.nodeAllocation}`}>
        <FactionScoreBars scores={entry.scores} total={entry.total} hideEmpty />
        {entry.attackers.length > 0 && (
          <div className={styles.playerBlock}>
            <PlayerTable attackers={entry.attackers} />
          </div>
        )}
      </div>
    </details>
  );
}

// Điểm phe góp cao nhất (màu label phe đó) + % so với tổng điểm đảo, làm
// tròn xuống số nguyên.
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

// "/ điểm cần claim" (đảo trung lập, hoặc đảo chưa ai góp điểm) — chữ đen,
// không theo màu phe.
function ClaimNeed({ entry }: { entry: NodeBoardEntry }) {
  return (
    <span className={`${styles.topShare} ${styles.claimNeed}`}>
      {" / "}
      {compact(entry.island.claimThreshold)}
    </span>
  );
}
