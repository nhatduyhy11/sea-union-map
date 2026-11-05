import { useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { bossImageUrl } from "../../../data/nodeBosses";
import { iconBoxSize } from "../../../domain/buildMapNodes";
import { useDebug } from "../../../stores/debug";
import { useSelection } from "../../../stores/selection";
import { BaseStats } from "./BaseStats";
import { IslandMarker } from "./IslandMarker";
import { NodeStats } from "./NodeStats";
import styles from "./IslandNode.module.css";
import type { AppNode } from "../../../types";

export function IslandNode({ data }: NodeProps<AppNode>) {
  // Hover chuột hoặc focus bất kỳ nút nào trong node (icon, ghim, popup) —
  // focus/blur của React bubble nên tương đương :focus-within.
  const [hovered, setHovered] = useState(false);
  // Màu + opacity nhóm trung lập — cùng nguồn với edge (picker debug trong
  // debug store); fallback của --faction vì inline style luôn ghi đè CSS default.
  const neutralColor = useDebug((state) => state.neutralColor);
  const neutralOpacity = useDebug((state) => state.neutralOpacity);
  // Trỏ từ panel (BXH cứ điểm / dot plot căn cứ) — chỉ viền hover, không bật
  // popup điểm.
  const linked = useSelection((state) => state.hovered === data.id);
  const isCenter = data.tier === 4;
  // Đảo chưa có chủ mà phe điểm cao nhất đã đạt ngưỡng claim → popup điểm
  // (NodeStats) đánh dấu claimable bằng nền sọc chéo màu phe đó.
  const claimLeader = !data.owner
    ? [...(data.scores ?? [])]
        .sort((a, b) => b.score - a.score)
        .find((entry) => entry.score >= data.claimThreshold)
    : undefined;
  const className = [
    styles.island,
    isCenter && styles.center,
    !data.owner && styles.neutral,
    linked && styles.linked,
    data.active && styles.active,
    data.matched && styles.hot,
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
      onFocus={() => setHovered(true)}
      onBlur={(event) => {
        // Chuyển focus giữa các nút trong node (icon → ghim → popup) không
        // tính là rời node, tránh popup unmount ngay trước khi nhận focus.
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setHovered(false);
        }
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="in"
        isConnectable={false}
      />
      <IslandMarker data={data} hovered={hovered} linked={linked} />
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
