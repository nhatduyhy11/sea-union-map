import {
  BaseEdge,
  getStraightPath,
  useInternalNode,
  type EdgeProps,
  type InternalNode,
} from "@xyflow/react";

// Anchor every edge at the node's center: icons are vertically centered on
// that same point, so any row of nodes shares one straight centerline.
function centerAnchor(node: InternalNode) {
  const { width, height } = node.measured ?? {};
  const topLeft = node.internals.positionAbsolute;
  if (!width || !height || !topLeft) return null;
  return { x: topLeft.x + width / 2, y: topLeft.y + height / 2 };
}

export function RouteEdge({ source, target, style }: EdgeProps) {
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
  return <BaseEdge path={path} style={style} />;
}
