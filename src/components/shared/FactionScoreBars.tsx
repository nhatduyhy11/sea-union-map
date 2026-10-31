import { compact } from "../../utils/format";
import styles from "./FactionScoreBars.module.css";
import type { FactionScore } from "../../types";

export interface FactionScoreBarsProps {
  scores: FactionScore[];
  total: number;
  // Ẩn bar của phe chưa có đóng góp (0 điểm) thay vì bar rỗng.
  hideEmpty?: boolean;
  // Thông tin đóng góp của player khi đang filter theo player
  playerHighlight?: {
    faction: string;
    score: number;
  };
}

// Thanh điểm phe: màu phe định danh phe (thứ tự cố định theo mảng factions),
// không kèm tên; số điểm nằm giữa thanh, chiều dài bar theo tỉ lệ điểm/tổng.
// Dùng chung NodeStats (canvas) và NodeDetails (panel).
export function FactionScoreBars({
  scores,
  total,
  hideEmpty,
  playerHighlight,
}: FactionScoreBarsProps) {
  const bars = hideEmpty
    ? scores.filter((faction) => faction.score > 0)
    : scores;
  return (
    <>
      {bars.map((faction) => {
        const isPlayerFaction =
          playerHighlight !== undefined &&
          faction.id === playerHighlight.faction;
        const isOtherFaction =
          playerHighlight !== undefined && !isPlayerFaction;

        const widthPct = total ? (faction.score / total) * 100 : 0;
        const playerPct =
          isPlayerFaction && faction.score > 0
            ? Math.min(100, (playerHighlight.score / faction.score) * 100)
            : 0;

        const scoreLabel = isPlayerFaction
          ? faction.score > 0
            ? `${compact(playerHighlight.score)} / ${compact(faction.score)}`
            : "0"
          : compact(faction.score);

        return (
          <div
            key={faction.id}
            className={`${styles.scoreBar} ${isOtherFaction ? styles.dimmed : ""}`}
          >
            <div
              className={`${styles.scoreFill} ${
                isPlayerFaction ? styles.playerFactionFill : ""
              }`}
              style={{
                width: `${widthPct}%`,
                background: isPlayerFaction
                  ? `color-mix(in srgb, ${faction.color} 30%, #e4e9ec)`
                  : faction.color,
              }}
            >
              {isPlayerFaction && playerPct > 0 && (
                <div
                  className={styles.playerFill}
                  style={{
                    width: `${playerPct}%`,
                    background: faction.color,
                  }}
                />
              )}
            </div>
            <b className={styles.scoreValue}>{scoreLabel}</b>
          </div>
        );
      })}
    </>
  );
}
