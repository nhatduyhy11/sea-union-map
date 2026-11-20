import { compact } from "../../../utils/format";
import styles from "./FactionScoreBars.module.css";
import type { FactionScore } from "../../../types";

export interface FactionScoreBarsProps {
  scores: FactionScore[];
  total: number;
  // Ẩn bar của phe chưa có đóng góp (0 điểm) thay vì bar rỗng.
  hideEmpty?: boolean;
  selectedFaction?: string | null;
  onFactionClick?: (id: string) => void;
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
  selectedFaction,
  onFactionClick,
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

        const hasFactionScore = isPlayerFaction && faction.score > 0;
        const hasPlayerScore =
          hasFactionScore && playerHighlight && playerHighlight.score > 0;

        const Bar = onFactionClick ? "button" : "div";
        return (
          <Bar
            key={faction.id}
            type={onFactionClick ? "button" : undefined}
            onClick={
              onFactionClick ? () => onFactionClick(faction.id) : undefined
            }
            aria-pressed={
              onFactionClick ? selectedFaction === faction.id : undefined
            }
            aria-label={
              onFactionClick ? `Lọc người chơi phe ${faction.name}` : undefined
            }
            title={
              onFactionClick
                ? `${faction.name}: bấm để lọc người chơi, bấm lại để bỏ lọc`
                : undefined
            }
            className={`${styles.scoreBar} ${onFactionClick ? styles.interactive : ""} ${selectedFaction === faction.id ? styles.selected : ""} ${isOtherFaction || (selectedFaction && selectedFaction !== faction.id) ? styles.dimmed : ""}`}
          >
            <span
              className={`${styles.scoreFill} ${
                hasFactionScore ? styles.playerFactionFill : ""
              } ${hasPlayerScore ? styles.hasScore : ""}`}
              style={{
                width: `${widthPct}%`,
                // Khi filter player: nền thanh phe pha nhạt 20% để dải đóng góp
                // của player (100% màu phe đặc) nổi bật rõ bên trong.
                background: isPlayerFaction
                  ? `color-mix(in srgb, ${faction.color} 20%, var(--surface-track, #e4e9ec))`
                  : faction.color,
              }}
            >
              {isPlayerFaction && playerPct > 0 && (
                <span
                  className={styles.playerFill}
                  style={
                    {
                      width: `${playerPct}%`,
                      background: faction.color,
                      // Màu mũ mép dải cho ::after trong CSS — derive từ màu
                      // phe nên phải truyền var, CSS không đọc được background.
                      "--cap": `color-mix(in srgb, ${faction.color} 60%, #1c2730)`,
                    } as React.CSSProperties
                  }
                />
              )}
            </span>
            <b
              className={`${styles.scoreValue} ${
                isPlayerFaction ? styles.playerScoreValue : ""
              }`}
            >
              {scoreLabel}
            </b>
          </Bar>
        );
      })}
    </>
  );
}
