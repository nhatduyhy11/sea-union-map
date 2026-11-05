import { ViewportPortal } from "@xyflow/react";
import { FactionBackdrop } from "./FactionBackdrop";
import { GuardianBackdrop } from "./GuardianBackdrop";
import { SceneryBackdrop } from "./SceneryBackdrop";
import styles from "./MapBackdrop.module.css";
import type { AppNode } from "../../../types";

// Lớp ảnh nền nằm dưới node/edge, đi theo pan/zoom của viewport. Thứ tự render
// là thứ tự chồng: boss giữ cửa nằm trên minh hoạ phe.
export function MapBackdrop({
  nodes,
  hoveredId,
}: {
  nodes: AppNode[];
  hoveredId: string | null;
}) {
  return (
    <ViewportPortal>
      <div className={styles.backdrop} aria-hidden="true">
        <SceneryBackdrop />
        <FactionBackdrop hoveredId={hoveredId} />
        <GuardianBackdrop nodes={nodes} hoveredId={hoveredId} />
      </div>
    </ViewportPortal>
  );
}
