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
import { useId, type CSSProperties } from "react";

function RoutePaths({
  path,
  style,
  dashColors,
}: {
  path: string;
  style?: CSSProperties;
  dashColors?: [string] | [string, string];
}) {
  if (dashColors?.length !== 2)
    return <BaseEdge path={path} style={style} interactionWidth={0} />;
  return (
    <>
      <BaseEdge
        path={path}
        style={{ ...style, stroke: dashColors[0] }}
        interactionWidth={0}
      />
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
  const maskId = useId().replace(/:/g, "");
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
  const history = data?.history;
  if (!history)
    return (
      <RoutePaths path={path} style={style} dashColors={data?.dashColors} />
    );
  const maskPath = history.reverse
    ? `M ${to.x},${to.y} L ${from.x},${from.y}`
    : path;
  const retreat = history.retreat;
  const retreatPath = retreat?.reverse
    ? `M ${to.x},${to.y} L ${from.x},${from.y}`
    : path;
  return (
    <>
      <defs>
        {retreat && (
          <mask
            id={`${maskId}-old`}
            maskUnits="userSpaceOnUse"
            x={Math.min(from.x, to.x) - 20}
            y={Math.min(from.y, to.y) - 20}
            width={Math.abs(to.x - from.x) + 40}
            height={Math.abs(to.y - from.y) + 40}
          >
            <path
              d={retreatPath}
              fill="none"
              stroke="white"
              strokeWidth={20}
              pathLength={1}
              strokeDasharray="1"
              style={{ strokeDashoffset: 0 }}
              data-history-effect="retreat-route"
              data-history-slot={history.slot}
              data-history-delay={retreat.delay}
              data-history-duration={retreat.duration}
            />
          </mask>
        )}
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x={Math.min(from.x, to.x) - 20}
          y={Math.min(from.y, to.y) - 20}
          width={Math.abs(to.x - from.x) + 40}
          height={Math.abs(to.y - from.y) + 40}
        >
          <path
            d={maskPath}
            fill="none"
            stroke="white"
            strokeWidth={20}
            pathLength={1}
            strokeDasharray="1"
            data-history-effect="route"
            data-history-delay={history.delay}
            data-history-duration={history.duration}
            data-history-slot={history.slot}
            style={{ strokeDashoffset: 1 }}
          />
        </mask>
      </defs>
      <BaseEdge
        path={path}
        style={{
          stroke: "#9caeb9",
          strokeWidth: 6,
          opacity: 0.25,
          strokeDasharray: "16 16",
        }}
        interactionWidth={0}
      />
      <g
        data-history-effect={retreat ? undefined : "exit"}
        data-history-slot={history.slot}
        mask={retreat ? `url(#${maskId}-old)` : undefined}
      >
        <RoutePaths
          path={path}
          style={history.previous.style}
          dashColors={history.previous.dashColors}
        />
      </g>
      <g mask={`url(#${maskId})`}>
        <RoutePaths path={path} style={style} dashColors={data?.dashColors} />
      </g>
    </>
  );
}
