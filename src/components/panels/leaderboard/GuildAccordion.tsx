import { ChevronRight, Users } from "lucide-react";
import { compact, number } from "../../../utils/format";
import { PlayerIdentity } from "../../shared/PlayerIdentity";
import { selectGuildMember, toggleGuildFilter } from "../../../stores/commands";
import { usePanel } from "../../../stores/panel";
import styles from "./GuildAccordion.module.css";
import shared from "./shared.module.css";
import type { FactionBoardEntry, GuildScore } from "../../../types";

// Danh sách guild của một phe. Filter mode: row điều khiển canvas
// (GuildAccordion); free mode: <details> thuần xem, member inert.
export function GuildList({
  faction,
  filterMode,
}: {
  faction: FactionBoardEntry;
  filterMode: boolean;
}) {
  const openGuild = usePanel((state) => state.openGuild);
  const selectedMember = usePanel((state) => state.selectedMember);
  return (
    <div className={`${shared.allocation} ${shared.allocationTall}`}>
      {faction.guilds.map((guild) =>
        filterMode ? (
          <GuildAccordion
            key={guild.guild}
            guild={guild}
            faction={faction}
            open={guild.guild === openGuild}
            selectedMember={selectedMember}
          />
        ) : (
          <InertGuild key={guild.guild} guild={guild} faction={faction} />
        )
      )}
    </div>
  );
}

// Guild row trong filter mode: bấm mở = filter canvas theo guild; member
// trong đó bấm = filter player (chọn lại = về guild cha).
function GuildAccordion({
  guild,
  faction,
  open,
  selectedMember,
}: {
  guild: GuildScore;
  faction: FactionBoardEntry;
  open: boolean;
  selectedMember: string | null;
}) {
  return (
    <div>
      <button
        className={`${styles.guildToggle} ${open ? styles.guildActive : ""}`}
        style={open ? { background: `${faction.color}14` } : undefined}
        onClick={() => toggleGuildFilter(guild.guild)}
      >
        <GuildLabel guild={guild} />
        <b>{number(guild.score)}</b>
        <ChevronRight
          size={13}
          className={open ? styles.chevronOpen : undefined}
        />
      </button>
      {open && (
        <MemberList
          guild={guild}
          faction={faction}
          selectedMember={selectedMember}
        />
      )}
    </div>
  );
}

// Guild row free mode: mở/đóng tự do, không đụng canvas.
function InertGuild({
  guild,
  faction,
}: {
  guild: GuildScore;
  faction: FactionBoardEntry;
}) {
  return (
    <details className={styles.guildDetails}>
      <summary className={styles.guildToggle}>
        <GuildLabel guild={guild} />
        <b>{number(guild.score)}</b>
        <ChevronRight size={13} />
      </summary>
      <MemberList guild={guild} faction={faction} inert />
    </details>
  );
}

// 2 dòng: tên guild [LC] / số người đóng góp · số đảo.
function GuildLabel({ guild }: { guild: GuildScore }) {
  return (
    <span className={styles.guildLabel}>
      <Users size={11} />
      <span className={styles.guildLines}>
        <span>
          {guild.name}{" "}
          {/* Luôn hiện — "—" = guild brief rỗng và không member nào có brief power. */}
          <span className={styles.power}>
            [{guild.power ? compact(guild.power) : "—"}]
          </span>
        </span>
        <small>
          {guild.players} người · {guild.nodes} đảo
        </small>
      </span>
    </span>
  );
}

// Danh sách thành viên guild. Filter mode: bấm member = filter player.
// inert (free mode / xem tự do): chỉ hiển thị, không affordance.
function MemberList({
  guild,
  faction,
  selectedMember,
  inert,
}: {
  guild: GuildScore;
  faction: FactionBoardEntry;
  selectedMember?: string | null;
  inert?: boolean;
}) {
  return (
    <div className={`${styles.memberList} ${inert ? styles.memberInert : ""}`}>
      {guild.members.map((member) =>
        inert ? (
          <div key={member.id} className={styles.memberRow}>
            <PlayerIdentity
              player={{ id: member.id, name: member.name, faction: faction.id }}
              faction={faction}
              nodeCount={member.nodes}
            />
            <b>{number(member.score)}</b>
          </div>
        ) : (
          <button
            key={member.id}
            className={`${styles.memberRow} ${
              selectedMember === member.id ? styles.memberSelected : ""
            }`}
            style={
              selectedMember === member.id
                ? { background: `${faction.color}1f` }
                : undefined
            }
            onClick={() => selectGuildMember(guild.guild, member.id)}
          >
            <PlayerIdentity
              player={{ id: member.id, name: member.name, faction: faction.id }}
              faction={faction}
              nodeCount={member.nodes}
            />
            <b>{number(member.score)}</b>
          </button>
        )
      )}
    </div>
  );
}
