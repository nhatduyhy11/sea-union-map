import {
  BaseEdge,
  getStraightPath,
  useInternalNode,
  type Edge,
  type EdgeProps,
  type InternalNode,
} from "@xyflow/react";
import {
  ROUTE_DASH,
  ROUTE_GAP,
  type RouteEdgeData,
} from "../../domain/buildMapEdges";

// Anchor every edge at the node's center: icons are vertically centered on
// that same point, so any row of nodes shares one straight centerline.
function centerAnchor(node: InternalNode) {
  const { width, height } = node.measured ?? {};
  const topLeft = node.internals.positionAbsolute;
  if (!width || !height || !topLeft) return null;
  return { x: topLeft.x + width / 2, y: topLeft.y + height / 2 };
}

export function RouteEdge({
  source,
  target,
  style,
  data,
}: EdgeProps<Edge<RouteEdgeData>>) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;
  const from = centerAnchor(sourceNode);
  const to = centerAnchor(targetNode);
  if (!from || !to) return null;
  const [path] = getStraightPath({
    sourceX: from.x,
    sourceY: from.y,
    targetX: to.x,
    targetY: to.y,
  });
  const dashColors = data?.dashColors;
  if (dashColors?.length !== 2) return <BaseEdge path={path} style={style} />;
  // Hai path chồng nhau cùng dasharray, path sau lệch nửa chu kỳ:
  // màu 1 – trống – màu 2 – trống.
  return (
    <>
      <BaseEdge path={path} style={{ ...style, stroke: dashColors[0] }} />
      <BaseEdge
        path={path}
        interactionWidth={0}
        style={{
          ...style,
          stroke: dashColors[1],
          strokeDashoffset: -(ROUTE_DASH + ROUTE_GAP),
        }}
      />
    </>
  );
}
