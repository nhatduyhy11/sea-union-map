import { useStore } from "@xyflow/react";
import { layoutNodes } from "../../../data/map-layout";
import styles from "./CanvasDebugGrid.module.css";

// Debug: guides through node centers — the horizontal axis through "4" plus a
// perpendicular through every central landmark, so same-row and same-column
// nodes' center dots sit on them.
const centralIds = layoutNodes
  .filter((node) => node.central)
  .map((node) => node.id);

export function CanvasDebugGrid() {
  const [tx, ty, zoom] = useStore((state) => state.transform);
  const lookup = useStore((state) => state.nodeLookup);
  const centers = centralIds.flatMap((id) => {
    const node = lookup.get(id);
    const { width, height } = node?.measured ?? {};
    if (!node || !width || !height) return [];
    return [
      {
        id,
        x: (node.internals.positionAbsolute.x + width / 2) * zoom + tx,
        y: (node.internals.positionAbsolute.y + height / 2) * zoom + ty,
      },
    ];
  });
  const axis = centers.find((center) => center.id === "4");
  if (!axis) return null;
  return (
    <>
      <div
        className={styles.debugLine}
        style={{ transform: `translateY(${axis.y}px)` }}
      />
      {centers.map((center) => (
        <div
          key={center.id}
          className={styles.debugVLine}
          style={{ transform: `translateX(${center.x}px)` }}
        />
      ))}
    </>
  );
}
