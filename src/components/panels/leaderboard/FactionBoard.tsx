import { useMemo, useState } from "react";
import { ChevronRight, HandFist } from "lucide-react";
import { compact } from "../../../utils/format";
import {
  rankFactions,
  rankFactionsForHighlight,
  sortGuilds,
} from "../../../domain/selectors";
import { toggleFactionView } from "../../../stores/commands";
import { usePanel } from "../../../stores/panel";
import { getFactionIcon } from "../../shared/factionIcons";
import { GuildList } from "./GuildAccordion";
import styles from "./FactionBoard.module.css";
import shared from "./shared.module.css";
import type { FactionBoardEntry } from "../../../types";

export function FactionBoard({ factions }: { factions: FactionBoardEntry[] }) {
  const filterMode = usePanel((state) => state.filterMode);
  const openFaction = usePanel((state) => state.openFaction);
  // Sub-tabs mirror the game's bottom row: "chung" + one tab per faction.
  // Thuần view — không đụng canvas; state local nên tự reset khi rời board.
  const [focus, setFocus] = useState<string | null>(null);
  const [sortByScore, setSortByScore] = useState(false);

  const displayFactions = useMemo(() => {
    const sortBy = sortByScore ? "score" : "power";
    return factions.map((entry) => ({
      ...entry,
      guilds: sortGuilds(entry.guilds, sortBy),
    }));
  }, [factions, sortByScore]);

  // List giữ thứ tự cố định; số hạng vẫn là thứ hạng theo điểm phe.
  const rankById = useMemo(() => rankFactions(factions), [factions]);
  // Tổng điểm ST của 4 phe — hiển thị cạnh phải tiêu đề board.
  const totalScore = useMemo(
    () => factions.reduce((total, entry) => total + entry.score, 0),
    [factions]
  );
  // Highlight riêng theo nhiên liệu (fallback Điểm phe khi dump thiếu fuel).
  const highlightById = useMemo(
    () => rankFactionsForHighlight(factions),
    [factions]
  );

  const faction = displayFactions.find((entry) => entry.id === focus);
  return (
    <>
      <div className={styles.headRow}>
        <h2>Xếp hạng phe</h2>
        <span className={styles.headTotal} title="Tổng điểm ST của 4 phe">
          {compact(totalScore)}
        </span>
      </div>
      <FactionTabs factions={factions} focus={focus} onFocus={setFocus} />
      <div className={shared.sortBar}>
        <label
          className={shared.sortOption}
          title="Bật: sắp xếp guild theo Điểm ST. Tắt: mặc định sắp xếp theo Lực chiến (LC)."
        >
          <input
            type="checkbox"
            checked={sortByScore}
            onChange={(event) => setSortByScore(event.target.checked)}
          />
          Sắp xếp Bang theo điểm
        </label>
      </div>
      {faction ? (
        <SingleFaction faction={faction} filterMode={filterMode} />
      ) : (
        displayFactions.map((entry) => (
          <FactionItem
            key={entry.id}
            entry={entry}
            rank={rankById.get(entry.id) ?? 0}
            leading={highlightById.get(entry.id) === 1}
            filterMode={filterMode}
            open={openFaction === entry.id}
          />
        ))
      )}
    </>
  );
}

function FactionTabs({
  factions,
  focus,
  onFocus,
}: {
  factions: FactionBoardEntry[];
  focus: string | null;
  onFocus: (id: string | null) => void;
}) {
  return (
    <div className={shared.subTabs}>
      <button
        className={focus ? "" : shared.selected}
        onClick={() => onFocus(null)}
      >
        Chung
      </button>
      {factions.map((entry) => (
        <button
          key={entry.id}
          className={`${shared.factionPill} ${focus === entry.id ? shared.selected : ""}`}
          style={{ "--label": entry.labelColor } as React.CSSProperties}
          onClick={() => onFocus(focus === entry.id ? null : entry.id)}
        >
          {entry.name}
        </button>
      ))}
    </div>
  );
}

// Filter mode: open do store điều khiển, bấm summary = filter canvas theo phe.
// Free mode: <details> uncontrolled, mở/đóng tự do.
function FactionItem({
  entry,
  rank,
  leading,
  filterMode,
  open,
}: {
  entry: FactionBoardEntry;
  rank: number;
  leading: boolean;
  filterMode: boolean;
  open: boolean;
}) {
  return (
    <details className={shared.item} open={filterMode ? open : undefined}>
      <summary
        className={`${shared.summary} ${shared.tintedSummary}`}
        // Highlight phe dẫn đầu nhiên liệu (data cũ thiếu fuel → fallback Điểm
        // phe, xem factionHighlight): chỉ viền trái màu phe, không tô nền.
        style={leading ? { borderLeftColor: entry.color } : undefined}
        onClick={
          filterMode
            ? (event) => {
                event.preventDefault();
                toggleFactionView(
                  entry.id,
                  entry.guilds.map((guild) => guild.guild)
                );
              }
            : undefined
        }
      >
        <span className={shared.rank}>{rank}</span>
        <FactionFlag entry={entry} />
        <FactionLines entry={entry} />
        <b>{compact(entry.score)}</b>
        <ChevronRight size={13} />
      </summary>
      <GuildList faction={entry} filterMode={filterMode} />
    </details>
  );
}

function FactionFlag({ entry }: { entry: FactionBoardEntry }) {
  const Icon = getFactionIcon(entry.id);
  return (
    <span
      className={styles.flag}
      style={{
        color: entry.labelColor,
        background: `${entry.labelColor}18`,
      }}
    >
      {Icon ? <Icon size={16} /> : entry.name[0]}
    </span>
  );
}

// 3 dòng: tên phe / số guild + tổng lực chiến (icon nắm đấm) / số đảo đang chiếm +
// Tổng Nhiên Liệu (ẩn khi dump thiếu fuel — data cũ).
function FactionLines({ entry }: { entry: FactionBoardEntry }) {
  return (
    <div className={shared.factionName} style={{ color: entry.labelColor }}>
      {entry.name}
      <small>
        {entry.guilds.length} guild |{" "}
        <span className={styles.power}>
          <HandFist size={9} />
          {entry.power ? compact(entry.power) : "—"}
        </span>
      </small>
      <small>
        {entry.islands} đảo
        {entry.fuel != null ? ` | ${compact(entry.fuel)} (nhiên liệu)` : ""}
      </small>
    </div>
  );
}

function SingleFaction({
  faction,
  filterMode,
}: {
  faction: FactionBoardEntry;
  filterMode: boolean;
}) {
  return (
    <>
      <div
        className={styles.factionCard}
        style={{ borderColor: faction.color }}
      >
        <FactionFlag entry={faction} />
        <FactionLines entry={faction} />
        <b>{compact(faction.score)}</b>
      </div>
      <GuildList faction={faction} filterMode={filterMode} />
    </>
  );
}
