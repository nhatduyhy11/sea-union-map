import { useState } from "react";
import { ReactFlow, Background, Controls, useStore } from "@xyflow/react";
import { mapBounds } from "../../data/map-layout";
import { FIT_VIEW_OPTIONS, useFitZoom } from "../../hooks/useFitMap";
import { useMapGraph } from "./useMapGraph";
import { useDebug } from "../../stores/debug";
import { useSelection } from "../../stores/selection";
import { CanvasDebugGrid } from "./map-debug";
import { FilterChip } from "./FilterChip";
import { IslandNode } from "./IslandNode";
import { RouteEdge } from "./RouteEdge";
import { MapBackdrop } from "./map-backdrop";
import styles from "./MapCanvas.module.css";

const nodeTypes = { island: IslandNode };
const edgeTypes = { route: RouteEdge };

// Sàn dự phòng khi canvas/node chưa đo xong — đủ thấp để fitView lúc mount
// không bị kẹp trên màn nào.
const FALLBACK_MIN_ZOOM = 0.05;

function ZoomLabel() {
  const zoom = useStore((state) => state.transform[2]);
  return <div className={styles.zoomLabel}>{Math.round(zoom * 100)}%</div>;
}

export function MapCanvas() {
  const { nodes, edges } = useMapGraph();
  // Node đang hover — rê chuột trực tiếp trên canvas hoặc trỏ từ panel
  // (BXH cứ điểm / dot plot / ô tìm đảo); lớp boss giữ cửa đậm lên theo node đó.
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const linkedNode = useSelection((state) => state.hovered);
  const debug = useDebug((state) => state.debug);
  // Màu nền chỉnh từ picker debug (DEV) — prod luôn giá trị mặc định.
  const canvasBg = useDebug((state) => state.canvasBg);
  const fitZoom = useFitZoom();
  return (
    <div className={styles.mapCanvas} style={{ background: canvasBg }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodeOrigin={[0.5, 0.5]}
        onNodeMouseEnter={(_, node) => setHoveredNode(node.id)}
        onNodeMouseLeave={() => setHoveredNode(null)}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        // Sàn zoom = đúng mức fit toàn map của canvas hiện tại: zoom-out tối
        // đa là thấy trọn map, không nhỏ hơn — tự theo kích thước màn hình.
        minZoom={fitZoom ?? FALLBACK_MIN_ZOOM}
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
        <MapBackdrop nodes={nodes} hoveredId={hoveredNode ?? linkedNode} />
        <Background color="#ece7d7" gap={40} size={1} />
        <Controls showInteractive={false} fitViewOptions={FIT_VIEW_OPTIONS} />
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
