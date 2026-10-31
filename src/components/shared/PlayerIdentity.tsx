import { HandFist } from "lucide-react";
import { compact } from "../../utils/format";
import { getFactionIcon } from "./factionIcons";
import styles from "./PlayerIdentity.module.css";
import type { Faction, Player } from "../../types";

export interface PlayerIdentityProps {
  player?: Player;
  faction?: Faction;
  nodeCount?: number;
  // Lực chiến player (brief). Inline mode: đuôi "| [HandFist] lc" sau tên; stacked mode: bỏ qua.
  power?: number;
  // BXH cá nhân: một dòng "Tên | LC" chữ đen — phe chỉ còn qua màu avatar.
  inline?: boolean;
}

export function PlayerIdentity({
  player,
  faction,
  nodeCount,
  power,
  inline,
}: PlayerIdentityProps) {
  const color = faction?.labelColor || "#97acbb";
  const name = player?.name || "Người chơi";
  const FactionIcon = getFactionIcon(faction?.id ?? player?.faction);

  if (inline) {
    // BXH cá nhân: "Tên | LC" + dòng dưới "Bang · N đảo" — chữ đen hết, phe
    // chỉ còn qua màu avatar (dùng icon phe thay chữ đầu tên).
    const meta = [
      ...(player?.guild ? [player.guild] : []),
      ...(nodeCount !== undefined ? [`${nodeCount} đảo`] : []),
    ];
    return (
      <>
        <span
          className={styles.avatar}
          style={{ color, background: `${color}18` }}
        >
          {FactionIcon ? <FactionIcon size={15} /> : name[0]}
        </span>
        <div className={styles.playerName}>
          {name}
          {power ? (
            <>
              {" | "}
              <span className={styles.power}>
                <HandFist size={10} />
                {compact(power)}
              </span>
            </>
          ) : null}
          <small style={{ color }}>{meta.join(" · ")}</small>
        </div>
      </>
    );
  }

  const meta = [
    faction?.name || "Không rõ",
    ...(player?.guild ? [player.guild] : []),
    ...(nodeCount !== undefined ? [`${nodeCount} đảo`] : []),
  ];

  return (
    <>
      <span
        className={styles.avatar}
        style={{ color, background: `${color}18` }}
      >
        {FactionIcon ? <FactionIcon size={15} /> : name[0]}
      </span>
      <div className={styles.playerName}>
        {name}
        <small style={{ color }}>{meta.join(" · ")}</small>
      </div>
    </>
  );
}
