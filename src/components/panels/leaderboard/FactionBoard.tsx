import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { compact, number } from "../../../utils/format";
import { toggleFactionView } from "../../../stores/commands";
import { usePanel } from "../../../stores/panel";
import { GuildAccordion, GuildLabel, MemberList } from "./GuildAccordion";
import styles from "./FactionBoard.module.css";
import shared from "./shared.module.css";
import guildStyles from "./GuildAccordion.module.css";
import type { FactionBoardEntry } from "../../../types";

export function FactionBoard({ factions }: { factions: FactionBoardEntry[] }) {
  const filterMode = usePanel((state) => state.filterMode);
  const openFaction = usePanel((state) => state.openFaction);
  const openGuild = usePanel((state) => state.openGuild);
  const selectedMember = usePanel((state) => state.selectedMember);
  // Sub-tabs mirror the game's bottom row: "chung" + one tab per faction.
  // Thuần view — không đụng canvas; state local nên tự reset khi rời board.
  const [focus, setFocus] = useState<string | null>(null);
  const [sortByScore, setSortByScore] = useState(false);

  const displayFactions = useMemo(() => {
    return factions.map((entry) => ({
      ...entry,
      guilds: [...entry.guilds].sort((a, b) =>
        sortByScore
          ? b.score - a.score
          : (b.power ?? 0) - (a.power ?? 0) || b.score - a.score
      ),
    }));
  }, [factions, sortByScore]);

  // List giữ thứ tự cố định; số hạng vẫn là thứ hạng theo điểm phe.
  const rankById = useMemo(
    () =>
      new Map(
        [...factions]
          .sort((a, b) => b.score - a.score)
          .map((entry, index) => [entry.id, index + 1])
      ),
    [factions]
  );

  // Highlight phe dẫn đầu tổng điểm: chỉ viền trái màu phe, không tô nền
  // (bỏ qua khi chưa ai có điểm).
  const leaderTint = (entry: FactionBoardEntry) =>
    entry.score > 0 && rankById.get(entry.id) === 1
      ? { borderLeftColor: entry.color }
      : undefined;

  const faction = displayFactions.find((entry) => entry.id === focus);
  return (
    <>
      <h2>Xếp hạng phe</h2>
      <div className={shared.subTabs}>
        <button
          className={faction ? "" : shared.selected}
          onClick={() => setFocus(null)}
        >
          Chung
        </button>
        {factions.map((entry) => (
          <button
            key={entry.id}
            className={`${shared.factionPill} ${faction?.id === entry.id ? shared.selected : ""}`}
            style={{ "--label": entry.labelColor } as React.CSSProperties}
            onClick={() => setFocus(faction?.id === entry.id ? null : entry.id)}
          >
            {entry.name}
          </button>
        ))}
      </div>
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
        <SingleFaction
          faction={faction}
          filterMode={filterMode}
          openGuild={openGuild}
          selectedMember={selectedMember}
        />
      ) : filterMode ? (
        displayFactions.map((entry) => (
          <details
            key={entry.id}
            className={shared.item}
            open={openFaction === entry.id}
          >
            <summary
              className={`${shared.summary} ${shared.tintedSummary}`}
              style={leaderTint(entry)}
              onClick={(event) => {
                event.preventDefault();
                toggleFactionView(
                  entry.id,
                  entry.guilds.map((guild) => guild.guild)
                );
              }}
            >
              <FactionSummary
                entry={entry}
                rank={rankById.get(entry.id) ?? 0}
              />
            </summary>
            <div className={`${shared.allocation} ${shared.allocationTall}`}>
              {entry.guilds.map((guild) => (
                <GuildAccordion
                  key={guild.guild}
                  guild={guild}
                  faction={entry}
                  open={guild.guild === openGuild}
                  selectedMember={selectedMember}
                />
              ))}
            </div>
          </details>
        ))
      ) : (
        displayFactions.map((entry) => (
          <details key={entry.id} className={shared.item}>
            <summary
              className={`${shared.summary} ${shared.tintedSummary}`}
              style={leaderTint(entry)}
            >
              <FactionSummary
                entry={entry}
                rank={rankById.get(entry.id) ?? 0}
              />
            </summary>
            <div className={`${shared.allocation} ${shared.allocationTall}`}>
              {entry.guilds.map((guild) => (
                <details key={guild.guild} className={guildStyles.guildDetails}>
                  <summary className={guildStyles.guildToggle}>
                    <GuildLabel guild={guild} />
                    <b>{number(guild.score)}</b>
                    <ChevronRight size={13} />
                  </summary>
                  <MemberList guild={guild} faction={entry} inert />
                </details>
              ))}
            </div>
          </details>
        ))
      )}
    </>
  );
}

function FactionSummary({
  entry,
  rank,
}: {
  entry: FactionBoardEntry;
  rank: number;
}) {
  return (
    <>
      <span className={shared.rank}>{rank}</span>
      <span
        className={styles.flag}
        style={{
          color: entry.labelColor,
          background: `${entry.labelColor}18`,
        }}
      >
        {entry.name[0]}
      </span>
      <FactionLines entry={entry} />
      <b>{compact(entry.score)}</b>
      <ChevronRight size={13} />
    </>
  );
}

// 3 dòng: tên phe / số guild + tổng lực chiến [LC] / số đảo đang chiếm.
function FactionLines({ entry }: { entry: FactionBoardEntry }) {
  return (
    <div className={shared.factionName} style={{ color: entry.labelColor }}>
      {entry.name}
      <small>
        {entry.guilds.length} guild{" "}
        <span className={styles.power}>
          [{entry.power ? compact(entry.power) : "—"}]
        </span>
      </small>
      <small>{entry.islands} đảo</small>
    </div>
  );
}

function SingleFaction({
  faction,
  filterMode,
  openGuild,
  selectedMember,
}: {
  faction: FactionBoardEntry;
  filterMode: boolean;
  openGuild: string | null;
  selectedMember: string | null;
}) {
  return (
    <>
      <div
        className={styles.factionCard}
        style={{ borderColor: faction.color }}
      >
        <span
          className={styles.flag}
          style={{
            color: faction.labelColor,
            background: `${faction.labelColor}18`,
          }}
        >
          {faction.name[0]}
        </span>
        <FactionLines entry={faction} />
        <b>{compact(faction.score)}</b>
      </div>
      <div className={`${shared.allocation} ${shared.allocationTall}`}>
        {filterMode
          ? faction.guilds.map((guild) => (
              <GuildAccordion
                key={guild.guild}
                guild={guild}
                faction={faction}
                open={guild.guild === openGuild}
                selectedMember={selectedMember}
              />
            ))
          : faction.guilds.map((guild) => (
              <details key={guild.guild} className={guildStyles.guildDetails}>
                <summary className={guildStyles.guildToggle}>
                  <GuildLabel guild={guild} />
                  <b>{number(guild.score)}</b>
                  <ChevronRight size={13} />
                </summary>
                <MemberList guild={guild} faction={faction} inert />
              </details>
            ))}
      </div>
    </>
  );
}
