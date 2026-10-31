import { useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Anchor, Castle, Pin } from "lucide-react";
import { iconBoxSize } from "../../../domain/mapGraph";
import { useDebug } from "../../../stores/debug";
import { getFactionIcon } from "../../shared/factionIcons";
import { NodeStats } from "./NodeStats";
import styles from "./IslandNode.module.css";
import type { AppNode } from "../../../types";

export function IslandNode({ data }: NodeProps<AppNode>) {
  const [hovered, setHovered] = useState(false);
  // Màu + opacity nhóm trung lập — cùng nguồn với edge (picker debug trong
  // debug store); fallback của --faction vì inline style luôn ghi đè CSS default.
  const neutralColor = useDebug((state) => state.neutralColor);
  const neutralOpacity = useDebug((state) => state.neutralOpacity);
  const FactionIcon = data.base
    ? getFactionIcon(data.factionInfo?.id ?? data.owner ?? data.id)
    : null;
  const Icon = FactionIcon ?? (data.central ? Castle : Anchor);
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
    data.active && styles.active,
    data.matched && styles.hot,
    data.dim && styles.dim,
  ]
    .filter(Boolean)
    .join(" ");
  const showStats = !data.base && (data.showAll || data.pinned || hovered);
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
        <Icon size={data.base ? 31 : 24} />
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
      {showStats && (
        <NodeStats
          nodeId={data.id}
          claimThreshold={data.claimThreshold}
          hasOwner={Boolean(data.owner)}
          tint={statTint}
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
