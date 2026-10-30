import { ReactFlow, Background, Controls, useStore } from "@xyflow/react";
import { mapBounds } from "../../data/map-layout";
import { FIT_VIEW_OPTIONS } from "../../hooks/useFitMap";
import { useMapGraph } from "./useMapGraph";
import { useDebug } from "../../stores/debug";
import { CanvasDebugGrid } from "./map-debug";
import { FilterChip } from "./FilterChip";
import { IslandNode } from "./IslandNode";
import { RouteEdge } from "./RouteEdge";
import styles from "./MapCanvas.module.css";

const nodeTypes = { island: IslandNode };
const edgeTypes = { route: RouteEdge };

function ZoomLabel() {
  const zoom = useStore((state) => state.transform[2]);
  return <div className={styles.zoomLabel}>{Math.round(zoom * 100)}%</div>;
}

export function MapCanvas() {
  const { nodes, edges } = useMapGraph();
  const debug = useDebug((state) => state.debug);
  // Màu nền chỉnh từ picker debug (DEV) — prod luôn giá trị mặc định.
  const canvasBg = useDebug((state) => state.canvasBg);
  return (
    <div className={styles.mapCanvas} style={{ background: canvasBg }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodeOrigin={[0.5, 0.5]}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        // Sàn zoom đủ thấp để fit cả map (rộng ~5100) vào canvas điện thoại
        // (~360px); 0.19 cũ kẹp fitView, màn hẹp chỉ thấy vùng giữa.
        minZoom={0.05}
        maxZoom={2}
        translateExtent={mapBounds}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesReconnectable={false}
        elementsSelectable={false}
        deleteKeyCode={null}
        colorMode="light"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#ece7d7" gap={40} size={1} />
        <Controls showInteractive={false} />
        {debug && <CanvasDebugGrid />}
        <ZoomLabel />
      </ReactFlow>
      <FilterChip />
      <div className={styles.watermark} aria-hidden>
        HUNTERS [S517]
      </div>
    </div>
  );
}
