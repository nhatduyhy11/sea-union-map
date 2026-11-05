import { ViewportPortal } from "@xyflow/react";
import { FactionBackdrop } from "./FactionBackdrop";
import { GuardianBackdrop } from "./GuardianBackdrop";
import { HeroBackdrop } from "./HeroBackdrop";
import { SceneryBackdrop } from "./SceneryBackdrop";
import styles from "./MapBackdrop.module.css";
import { useSelection } from "../../../stores/selection";
import type { AppNode } from "../../../types";

// Lớp ảnh nền nằm dưới node/edge, đi theo pan/zoom của viewport. Thứ tự render
// là thứ tự chồng: boss giữ cửa nằm trên minh hoạ phe. Ảnh gắn với node
// (minh hoạ phe của căn cứ, boss giữ cửa) đậm lên khi node đó được hover hoặc
// đang chọn.
export function MapBackdrop({
  nodes,
  hoveredId,
}: {
  nodes: AppNode[];
  hoveredId: string | null;
}) {
  const selectedId = useSelection((state) => state.selected);
  const litIds = [hoveredId, selectedId].filter((id) => id !== null);
  return (
    <ViewportPortal>
      <div className={styles.backdrop} aria-hidden="true">
        <SceneryBackdrop />
        <HeroBackdrop />
        <FactionBackdrop litIds={litIds} />
        <GuardianBackdrop nodes={nodes} litIds={litIds} />
      </div>
    </ViewportPortal>
  );
}
