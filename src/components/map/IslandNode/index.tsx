import { useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Anchor,
  BicepsFlexed,
  Castle,
  Flag,
  Gift,
  Pin,
  Scissors,
  ShieldAlert,
  Sword,
  Swords,
} from "lucide-react";
import { bossImageUrl } from "../../../data/nodeBosses";
import { iconBoxSize } from "../../../domain/mapGraph";
import { useDebug } from "../../../stores/debug";
import { useSelection } from "../../../stores/selection";
import { getFactionIcon } from "../../shared/factionIcons";
import { BaseStats } from "./BaseStats";
import { NodeStats } from "./NodeStats";
import styles from "./IslandNode.module.css";
import type { AppNode } from "../../../types";

export function IslandNode({ data }: NodeProps<AppNode>) {
  const [hovered, setHovered] = useState(false);
  // Màu + opacity nhóm trung lập — cùng nguồn với edge (picker debug trong
  // debug store); fallback của --faction vì inline style luôn ghi đè CSS default.
  const neutralColor = useDebug((state) => state.neutralColor);
  const neutralOpacity = useDebug((state) => state.neutralOpacity);
  // Trỏ từ panel (chấm dot plot chi tiết căn cứ) — chỉ viền hover, không bật
  // popup điểm.
  const linked = useSelection((state) => state.hovered === data.id);
  const FactionIcon = data.base
    ? getFactionIcon(data.factionInfo?.id ?? data.owner ?? data.id)
    : null;
  const statusIcons = {
    base: null,
    anchor: Anchor,
    castle: Castle,
    belowClaim: Sword,
    frozen: Scissors,
    frontline: Swords,
    defend: ShieldAlert,
    gifted: Gift,
    aftermath: Flag,
    overbuilt: BicepsFlexed,
    plain: null,
  };
  const Icon =
    FactionIcon ??
    (data.canvasIcon
      ? statusIcons[data.canvasIcon]
      : data.owner
        ? null
        : data.central
          ? Castle
          : Anchor);
  const direction = data.id === "4" ? "TRUNG TÂM" : "";
  // Đảo chưa có chủ mà phe điểm cao nhất đã đạt ngưỡng claim → popup điểm
  // (NodeStats) đánh dấu claimable bằng nền sọc chéo màu phe đó.
  const claimLeader = !data.owner
    ? [...(data.scores ?? [])]
        .sort((a, b) => b.score - a.score)
        .find((entry) => entry.score >= data.claimThreshold)
    : undefined;
  const className = [
    styles.island,
    data.base && styles.base,
    data.central && styles.central,
    !data.owner && styles.neutral,
    linked && styles.linked,
    data.active && styles.active,
    data.matched && styles.hot,
    data.frontline && styles.frontline,
    data.defend && styles.defend,
    data.dim && styles.dim,
  ]
    .filter(Boolean)
    .join(" ");
  const showStats = !data.base && (data.showAll || data.pinned || hovered);
  // Căn cứ: popover tóm tắt phe — chỉ hover/ghim, "Điểm toàn map" không bật
  // (4 khối phe phủ kín góc map).
  const showBaseStats = data.base && (data.pinned || hovered);
  // Phe đại diện cho màu nền popup: phe đang giữ đảo, hoặc với đảo chưa chủ
  // là phe đủ ngưỡng claim đứng đầu (undefined → nền trắng như cũ).
  const statTint = data.factionInfo?.color ?? claimLeader?.color;

  return (
    <div
      className={className}
      style={
        {
          "--faction": data.factionInfo?.color || neutralColor,
          "--neutral-opacity": neutralOpacity,
          "--icon-box": `${iconBoxSize(data)}px`,
        } as React.CSSProperties
      }
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="in"
        isConnectable={false}
      />
      <button
        className={`${styles.islandIcon} nodrag`}
        onClick={() => data.open(data.id)}
        aria-label={`Xem ${data.id} ${data.name}`}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      >
        {Icon && <Icon size={data.base ? 31 : 24} />}
      </button>
      <div className={styles.islandLabel}>
        <div className={styles.labelWrapper}>
          {data.base ? (
            // Base chỉ hiện tên in-game ("Vịnh Thao Thiết"...), không id/hướng.
            data.name
          ) : (
            <>
              <span>{data.id}</span> {direction}
            </>
          )}
          <button
            className={`${styles.pin} nodrag ${data.pinned ? styles.pinned : ""}`}
            aria-label={`${data.pinned ? "Bỏ ghim" : "Ghim"} ${data.id}`}
            aria-pressed={data.pinned}
            onClick={() => data.pin(data.id)}
          >
            <Pin size={13} />
          </button>
        </div>
      </div>
      {data.debug && <span className={styles.centerDot} aria-hidden />}
      {showBaseStats && (
        <BaseStats factionId={data.owner ?? data.id} pinned={data.pinned} />
      )}
      {showStats && (
        <NodeStats
          nodeId={data.id}
          claimThreshold={data.claimThreshold}
          hasOwner={Boolean(data.owner)}
          tint={statTint}
          bossImage={data.monsterId ? bossImageUrl(data.monsterId) : undefined}
          scores={data.scores}
          pinned={data.pinned}
          onTogglePin={() => data.pin(data.id)}
          playerHighlight={data.playerHighlight}
        />
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        id="out"
        isConnectable={false}
      />
    </div>
  );
}
