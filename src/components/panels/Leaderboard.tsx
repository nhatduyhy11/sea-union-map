import { ChevronRight, Users } from "lucide-react";
import { compact, number } from "../../utils/format";
import { PlayerIdentity } from "../shared/PlayerIdentity";
import { useFocusIsland } from "../../hooks/useFocusIsland";
import { factionBoard, leaderboard, nodeBoard } from "../../domain/mapData";
import { selectFaction } from "../../stores/commands";
import { useMapView } from "../../stores/mapView";
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
  const setBoard = usePanel((state) => state.setBoard);
  // Filter phe của canvas legend — dùng chung làm sub-tab của BXH Phe nên
  // chọn phe ở panel cũng lọc map (và ngược lại). "all"/"neutral" = tab Chung.
  const factionFocus = useMapView((state) => state.filter);
  const focusIsland = useFocusIsland();
  return (
    <div className={`${styles.detail} ${styles.ranking}`}>
      <div className={styles.boardTabs}>
        <button
          className={board === "faction" ? styles.selected : ""}
          onClick={() => setBoard("faction")}
        >
          Phe
        </button>
        <button
          className={board === "player" ? styles.selected : ""}
          onClick={() => setBoard("player")}
        >
          Cá nhân
        </button>
        <button
          className={board === "node" ? styles.selected : ""}
          onClick={() => setBoard("node")}
        >
          Cứ điểm
        </button>
      </div>
      {board === "faction" ? (
        <FactionBoard
          factions={factionBoard}
          focus={factionFocus}
          onSelect={selectFaction}
        />
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

function FactionBoard({
  factions,
  focus,
  onSelect,
}: {
  factions: FactionBoardEntry[];
  focus: string;
  onSelect: (id: string) => void;
}) {
  // Sub-tabs mirror the game's bottom row: "chung" + one tab per faction.
  // Selection = filter của canvas legend; chọn lại phe đang chọn (hoặc chọn
  // khi filter là neutral) quay về Chung qua toggle của onSelect.
  const faction = factions.find((entry) => entry.id === focus);
  return (
    <>
      <div className={styles.eyebrow}>TOÀN CHIẾN TRƯỜNG</div>
      <h2>Xếp hạng phe</h2>
      <p>Điểm phe là tổng Điểm ST của các guild thành viên.</p>
      <div className={styles.subTabs}>
        <button
          className={faction ? "" : styles.selected}
          onClick={() => onSelect(focus)}
        >
          Chung
        </button>
        {factions.map((entry) => (
          <button
            key={entry.id}
            className={faction?.id === entry.id ? styles.selected : ""}
            onClick={() => onSelect(entry.id)}
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
