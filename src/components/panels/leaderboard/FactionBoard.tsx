import { useState } from "react";
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
  const faction = factions.find((entry) => entry.id === focus);
  return (
    <>
      <h2>Xếp hạng phe</h2>
      <p>Điểm phe là tổng Điểm ST của các guild thành viên.</p>
      <div className={styles.subTabs}>
        <button
          className={faction ? "" : styles.selected}
          onClick={() => setFocus(null)}
        >
          Chung
        </button>
        {factions.map((entry) => (
          <button
            key={entry.id}
            className={faction?.id === entry.id ? styles.selected : ""}
            onClick={() => setFocus(faction?.id === entry.id ? null : entry.id)}
          >
            {entry.short ?? entry.name}
          </button>
        ))}
      </div>
      {faction ? (
        <SingleFaction
          faction={faction}
          filterMode={filterMode}
          openGuild={openGuild}
          selectedMember={selectedMember}
        />
      ) : filterMode ? (
        factions.map((entry, index) => (
          <details
            key={entry.id}
            className={shared.item}
            open={openFaction === entry.id}
          >
            <summary
              className={shared.summary}
              onClick={(event) => {
                event.preventDefault();
                toggleFactionView(
                  entry.id,
                  entry.guilds.map((guild) => guild.guild)
                );
              }}
            >
              <FactionSummary entry={entry} index={index} />
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
        factions.map((entry, index) => (
          <details key={entry.id} className={shared.item}>
            <summary className={shared.summary}>
              <FactionSummary entry={entry} index={index} />
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
  index,
}: {
  entry: FactionBoardEntry;
  index: number;
}) {
  return (
    <>
      <span className={shared.rank}>{index + 1}</span>
      <span
        className={styles.flag}
        style={{
          color: entry.color,
          background: `${entry.color}18`,
        }}
      >
        {entry.name[0]}
      </span>
      <div className={shared.factionName}>
        {entry.name}
        <small style={{ color: entry.color }}>
          {entry.islands} đảo · {entry.guilds.length} guild
        </small>
      </div>
      <b>{compact(entry.score)}</b>
      <ChevronRight size={13} />
    </>
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
          style={{ color: faction.color, background: `${faction.color}18` }}
        >
          {faction.name[0]}
        </span>
        <div className={shared.factionName}>
          {faction.name}
          <small style={{ color: faction.color }}>
            {faction.islands} đảo · {faction.guilds.length} guild
          </small>
        </div>
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
