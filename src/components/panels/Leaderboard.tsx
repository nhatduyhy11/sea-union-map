import { useState } from "react";
import { ChevronRight, Users } from "lucide-react";
import { compact, number } from "../../utils/format";
import { PlayerIdentity } from "../shared/PlayerIdentity";
import styles from "./Leaderboard.module.css";
import type {
  FactionBoardEntry,
  FactionScore,
  GuildScore,
  LeaderboardPlayer,
  NodeBoardEntry,
} from "../../types";

export interface LeaderboardProps {
  players: LeaderboardPlayer[];
  factions: FactionBoardEntry[];
  nodes: NodeBoardEntry[];
  onFocusIsland: (id: string) => void;
}

// Mirrors the in-game BXH screen: "Cứ điểm | Xếp hạng cá nhân | Xếp hạng phe"
// top tabs, and the phe tab splits into "chung" + one sub-tab per faction
// (SEA_STRUCTURE.md §3.2).
type Board = "node" | "player" | "faction";

export function Leaderboard({
  players,
  factions,
  nodes,
  onFocusIsland,
}: LeaderboardProps) {
  const [board, setBoard] = useState<Board>("faction");
  return (
    <div className={`${styles.detail} ${styles.ranking}`}>
      <div className={styles.boardTabs}>
        <button
          className={board === "node" ? styles.selected : ""}
          onClick={() => setBoard("node")}
        >
          Cứ điểm
        </button>
        <button
          className={board === "player" ? styles.selected : ""}
          onClick={() => setBoard("player")}
        >
          Cá nhân
        </button>
        <button
          className={board === "faction" ? styles.selected : ""}
          onClick={() => setBoard("faction")}
        >
          Phe
        </button>
      </div>
      {board === "node" ? (
        <NodeBoard nodes={nodes} onFocusIsland={onFocusIsland} />
      ) : board === "player" ? (
        <PlayerBoard players={players} onFocusIsland={onFocusIsland} />
      ) : (
        <FactionBoard factions={factions} />
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
      <div className={styles.eyebrow}>TOÀN CHIẾN TRƯỜNG</div>
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
      <div className={styles.eyebrow}>TOÀN CHIẾN TRƯỜNG</div>
      <h2>Xếp hạng cá nhân</h2>
      <p>Tổng điểm mẫu trên tất cả cứ điểm.</p>
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
  // Sub-tabs mirror the game's bottom row: "chung" + one tab per faction.
  const [selected, setSelected] = useState<string>("all");
  const faction = factions.find((entry) => entry.id === selected);
  return (
    <>
      <div className={styles.eyebrow}>TOÀN CHIẾN TRƯỜNG</div>
      <h2>Xếp hạng phe</h2>
      <p>Điểm phe là tổng Điểm ST của các guild thành viên.</p>
      <div className={styles.subTabs}>
        <button
          className={selected === "all" ? styles.selected : ""}
          onClick={() => setSelected("all")}
        >
          Chung
        </button>
        {factions.map((entry) => (
          <button
            key={entry.id}
            className={selected === entry.id ? styles.selected : ""}
            onClick={() => setSelected(entry.id)}
          >
            {entry.short ?? entry.name}
          </button>
        ))}
      </div>
      {faction ? (
        <SingleFaction faction={faction} />
      ) : (
        factions.map((entry, index) => (
          <details key={entry.id} className={styles.item}>
            <summary className={styles.summary}>
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
            </summary>
            <div className={styles.allocation}>
              {entry.guilds.map((guild) => (
                <GuildRow key={guild.guild} guild={guild} />
              ))}
            </div>
          </details>
        ))
      )}
    </>
  );
}

function SingleFaction({ faction }: { faction: FactionBoardEntry }) {
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
        {faction.guilds.map((guild) => (
          <GuildRow key={guild.guild} guild={guild} />
        ))}
      </div>
    </>
  );
}

function GuildRow({ guild }: { guild: GuildScore }) {
  return (
    <div className={styles.guildRow}>
      <span>
        <Users size={11} /> {guild.guild}
        <small> · {guild.players} người</small>
      </span>
      <b>{number(guild.score)}</b>
    </div>
  );
}
