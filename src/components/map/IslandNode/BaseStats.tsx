import { useMemo } from "react";
import { rankFactions } from "../../../domain/selectors";
import { useMapData } from "../../../stores/dataset";
import {
  FactionFlag,
  FactionLines,
  ScoreCol,
} from "../../shared/FactionSummary";
import styles from "./BaseStats.module.css";

// Popover hover của căn cứ: tóm tắt phe giống một dòng BXH Phe (hạng theo
// điểm phe, cờ, guild/LC, ba tập đảo, điểm + nhiên liệu).
export function BaseStats({
  factionId,
  pinned,
}: {
  factionId: string;
  pinned?: boolean;
}) {
  const { factionBoard } = useMapData();
  const rankById = useMemo(() => rankFactions(factionBoard), [factionBoard]);
  const entry = factionBoard.find((faction) => faction.id === factionId);
  if (!entry) return null;
  return (
    <div
      className={`${styles.baseStats} ${pinned ? styles.pinned : ""}`}
      style={{ "--tint": entry.color } as React.CSSProperties}
    >
      <span className={styles.rank}>{rankById.get(entry.id)}</span>
      <FactionFlag entry={entry} />
      <FactionLines entry={entry} />
      <ScoreCol entry={entry} />
    </div>
  );
}
