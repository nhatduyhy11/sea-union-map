import { ReactFlow, Background, Controls, useStore } from "@xyflow/react";
import { mapBounds, layoutNodes } from "../../data/map-layout";
import { FIT_VIEW_OPTIONS } from "../../hooks/useFitMap";
import { useMapGraph } from "../../hooks/useMapGraph";
import { useMapView } from "../../stores/mapView";
import { FilterChip } from "./FilterChip";
import { IslandNode } from "./IslandNode";
import { RouteEdge } from "./RouteEdge";
import styles from "./MapCanvas.module.css";

const nodeTypes = { island: IslandNode };
const edgeTypes = { route: RouteEdge };

// Debug: guides through node centers — the horizontal axis through "4" plus a
// perpendicular through every central landmark, so same-row and same-column
// nodes' center dots sit on them.
const centralIds = layoutNodes
  .filter((node) => node.central)
  .map((node) => node.id);

function DebugGuides() {
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

function ZoomLabel() {
  const zoom = useStore((state) => state.transform[2]);
  return <div className={styles.zoomLabel}>{Math.round(zoom * 100)}%</div>;
}

export function MapCanvas() {
  const { nodes, edges } = useMapGraph();
  const debug = useMapView((state) => state.debug);
  return (
    <div className={styles.mapCanvas}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodeOrigin={[0.5, 0.5]}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        minZoom={0.19}
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
        {debug && <DebugGuides />}
        <ZoomLabel />
      </ReactFlow>
      <FilterChip />
      <div className={styles.watermark} aria-hidden>
        HUNTERS [S517]
      </div>
    </div>
  );
}
