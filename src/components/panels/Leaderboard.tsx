import { useState } from "react";
import { ChevronRight, Users } from "lucide-react";
import { compact, number } from "../../utils/format";
import { PlayerIdentity } from "../shared/PlayerIdentity";
import { useFocusIsland } from "../../hooks/useFocusIsland";
import { factionBoard, leaderboard, nodeBoard } from "../../domain/mapData";
import {
  selectGuildMember,
  setFilterMode,
  setRankingBoard,
  toggleFactionView,
  toggleGuildFilter,
} from "../../stores/commands";
import { usePanel } from "../../stores/panel";
import styles from "./Leaderboard.module.css";
import type {
  FactionBoardEntry,
  FactionScore,
  GuildScore,
  LeaderboardPlayer,
  NodeBoardEntry,
} from "../../types";

// Mirrors the in-game BXH screen (SEA_STRUCTURE.md §3.2): 3 tab với thứ tự UI
// Phe → Cá nhân → Cứ điểm (game để Cứ điểm trước — owner muốn Phe lên đầu vì
// là aggregate chính); tab Phe chia "chung" + một sub-tab mỗi phe.
export function Leaderboard() {
  const board = usePanel((state) => state.board);
  const filterMode = usePanel((state) => state.filterMode);
  const focusIsland = useFocusIsland();
  return (
    <div className={`${styles.detail} ${styles.ranking}`}>
      <div className={styles.rankingHead}>
        <span className={styles.eyebrow}>TOÀN CHIẾN TRƯỜNG</span>
        <label
          className={styles.filterMode}
          title="Bật: mở dòng là lọc canvas (một dòng tại một thời điểm). Tắt: chỉ đọc, không đụng canvas."
        >
          <input
            type="checkbox"
            checked={filterMode}
            onChange={(event) => setFilterMode(event.target.checked)}
          />
          Filter mode
        </label>
      </div>
      <div className={styles.boardTabs}>
        <button
          className={board === "faction" ? styles.selected : ""}
          onClick={() => setRankingBoard("faction")}
        >
          Phe
        </button>
        <button
          className={board === "player" ? styles.selected : ""}
          onClick={() => setRankingBoard("player")}
        >
          Cá nhân
        </button>
        <button
          className={board === "node" ? styles.selected : ""}
          onClick={() => setRankingBoard("node")}
        >
          Cứ điểm
        </button>
      </div>
      {board === "faction" ? (
        <FactionBoard factions={factionBoard} />
      ) : board === "player" ? (
        <PlayerBoard players={leaderboard} onFocusIsland={focusIsland} />
      ) : (
        <NodeBoard nodes={nodeBoard} onFocusIsland={focusIsland} />
      )}
    </div>
  );
}

function NodeBoard({
  nodes,
  onFocusIsland,
}: {
  nodes: NodeBoardEntry[];
  onFocusIsland: (id: string) => void;
}) {
  return (
    <>
      <h2>Xếp hạng cứ điểm</h2>
      <p>Cứ điểm xếp theo tổng Điểm ST các phe đã đổ vào.</p>
      {nodes.map((entry, index) => (
        <details key={entry.island.id} className={styles.item}>
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
            <button onClick={() => onFocusIsland(entry.island.id)}>
              <span>Xem đảo trên map</span>
            </button>
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

function PlayerBoard({
  players,
  onFocusIsland,
}: {
  players: LeaderboardPlayer[];
  onFocusIsland: (id: string) => void;
}) {
  return (
    <>
      <h2>Xếp hạng cá nhân</h2>
      <p>Tổng Điểm ST gộp từ BXH từng cứ điểm (top-N mỗi node).</p>
      {players.map((player, index) => (
        <details key={player.id} className={styles.item}>
          <summary className={styles.summary}>
            <span className={styles.rank}>{index + 1}</span>
            <PlayerIdentity
              player={player}
              faction={player.factionInfo}
              nodeCount={player.nodes}
            />
            <b>{compact(player.score)}</b>
            <ChevronRight size={13} />
          </summary>
          <div className={styles.allocation}>
            {player.allocations.map((entry) => (
              <button
                key={entry.nodeId}
                onClick={() => onFocusIsland(entry.nodeId)}
              >
                <span>Đảo {entry.nodeId}</span>
                <b>{number(entry.score)}</b>
              </button>
            ))}
          </div>
        </details>
      ))}
    </>
  );
}

function FactionBoard({ factions }: { factions: FactionBoardEntry[] }) {
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
            className={styles.item}
            open={openFaction === entry.id}
          >
            <summary
              className={styles.summary}
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
            <div className={styles.allocation}>
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
          <details key={entry.id} className={styles.item}>
            <summary className={styles.summary}>
              <FactionSummary entry={entry} index={index} />
            </summary>
            <div className={styles.allocation}>
              {entry.guilds.map((guild) => (
                <details key={guild.guild} className={styles.guildDetails}>
                  <summary className={styles.guildToggle}>
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
      <span className={styles.rank}>{index + 1}</span>
      <span
        className={styles.flag}
        style={{
          color: entry.color,
          background: `${entry.color}18`,
        }}
      >
        {entry.name[0]}
      </span>
      <div className={styles.factionName}>
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
        <div className={styles.factionName}>
          {faction.name}
          <small style={{ color: faction.color }}>
            {faction.islands} đảo · {faction.guilds.length} guild
          </small>
        </div>
        <b>{compact(faction.score)}</b>
      </div>
      <div className={styles.allocation}>
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
              <details key={guild.guild} className={styles.guildDetails}>
                <summary className={styles.guildToggle}>
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

function GuildLabel({ guild }: { guild: GuildScore }) {
  return (
    <span className={styles.guildLabel}>
      <Users size={11} /> {guild.guild}
      <small>
        · {guild.players} người · {guild.nodes} đảo
      </small>
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
