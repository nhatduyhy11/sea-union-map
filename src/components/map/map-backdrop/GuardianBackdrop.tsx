import { bossImageUrl } from "../../../data/nodeBosses";
import styles from "./GuardianBackdrop.module.css";
import type { AppNode } from "../../../types";

// Hai cứ điểm kẹp hai đầu trung tâm 4 trên trục giữa: boss của node hiện mờ
// làm nền như hai hộ vệ giữ cửa, tâm ảnh trùng tâm node; 3-2 lật ngang để cả
// hai cùng quay mặt vào trung tâm. Nằm ở lớp nền thay vì trong node để độ mờ
// cố định, không ăn theo opacity của node (trung lập / dim); chỉ đậm lên khi
// hover đúng node đó.
const GUARDIANS: Record<string, "east" | "west"> = {
  "3-1": "east",
  "3-2": "west",
};

export function GuardianBackdrop({
  nodes,
  hoveredId,
}: {
  nodes: AppNode[];
  hoveredId: string | null;
}) {
  return nodes.flatMap((node) => {
    const facing = GUARDIANS[node.id];
    const src =
      facing && node.data.monsterId
        ? bossImageUrl(node.data.monsterId)
        : undefined;
    if (!src) return [];
    return (
      <img
        key={node.id}
        className={`${styles.guardian} ${facing === "west" ? styles.faceWest : ""} ${node.id === hoveredId ? styles.hovered : ""}`}
        src={src}
        alt=""
        draggable={false}
        decoding="async"
        style={{ left: node.position.x, top: node.position.y }}
      />
    );
  });
}
