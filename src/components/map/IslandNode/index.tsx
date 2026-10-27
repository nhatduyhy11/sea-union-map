import { useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Anchor, Castle, Pin } from "lucide-react";
import { iconBoxSize } from "../../../domain/mapGraph";
import { useMapView } from "../../../stores/mapView";
import { NodeStats } from "./NodeStats";
import styles from "./IslandNode.module.css";
import type { AppNode } from "../../../types";

export function IslandNode({ data }: NodeProps<AppNode>) {
  const [hovered, setHovered] = useState(false);
  // Màu + opacity nhóm trung lập — cùng nguồn với edge (picker debug trong
  // mapView); fallback của --faction vì inline style luôn ghi đè CSS default.
  const neutralColor = useMapView((state) => state.neutralColor);
  const neutralOpacity = useMapView((state) => state.neutralOpacity);
  const Icon = data.base || data.central ? Castle : Anchor;
  const direction = data.id === "4" ? "TRUNG TÂM" : "";
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
      {data.debug && <span className={styles.centerDot} aria-hidden />}
      {showStats && (
        <NodeStats
          nodeId={data.id}
          name={data.name}
          scores={data.scores}
          pinned={data.pinned}
          onTogglePin={() => data.pin(data.id)}
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
