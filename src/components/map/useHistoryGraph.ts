import { useMemo } from "react";
import type { Edge } from "@xyflow/react";
import { factions } from "../../data/factions";
import { buildMapEdges, type RouteEdgeData } from "../../domain/buildMapEdges";
import { buildMapNodes } from "../../domain/buildMapNodes";
import {
  historyOrigin,
  planHistoryTransition,
} from "../../domain/historyPlayback";
import {
  inspectHistory,
  useHistoryPlayback,
} from "../../stores/historyPlayback";
import type { AppNode } from "../../types";

export function useHistoryGraph(nodes: AppNode[], edges: Edge[]) {
  const frames = useHistoryPlayback((state) => state.frames);
  const index = useHistoryPlayback((state) => state.index);
  const status = useHistoryPlayback((state) => state.status);
  const active = status === "playing" || status === "paused";
  return useMemo(() => {
    if (!active || !frames[index]) return { nodes, edges };
    const to = frames[index].data;
    const from = index ? frames[index - 1].data : historyOrigin(to);
    const { growth: plan, retreat } = planHistoryTransition(from, to);
    const template = nodes[0]?.data;
    if (!template) return { nodes, edges };
    const actions = {
      openIsland: (id: string) => {
        inspectHistory();
        template.open(id);
      },
      togglePin: (id: string) => {
        inspectHistory();
        template.pin(id);
      },
    };
    const project = (model: typeof to) =>
      buildMapNodes(
        model.ownedIslands,
        model.scoresByNode,
        model.frontlineByNode,
        model.defendNodeIds,
        factions,
        { selected: null, pinned: new Set(), showAll: false, matched: null },
        actions,
        model.canvasIconByNode
      );
    const oldNodes = new Map(project(from).map((node) => [node.id, node.data]));
    const nextNodes = project(to).map((node) => {
      const old = oldNodes.get(node.id)!;
      const changed =
        !node.data.base &&
        (old.owner !== node.data.owner ||
          old.canvasIcon !== node.data.canvasIcon);
      return {
        ...node,
        data: {
          ...node.data,
          historyActive: true,
          historyFrom: changed ? { ...old, historyActive: true } : undefined,
          historyDelay: plan.nodes.get(node.id)!.delay,
          historyDuration: plan.nodes.get(node.id)!.duration,
          historySlot: index,
          historyRetreat: retreat.nodes.get(node.id),
        },
      };
    });
    const oldEdges = new Map(
      buildMapEdges(
        from.routes,
        from.ownedIslands,
        factions,
        false,
        undefined,
        undefined,
        from.attackerByNode
      ).map((edge) => [edge.id, edge])
    );
    const nextEdges = buildMapEdges(
      to.routes,
      to.ownedIslands,
      factions,
      false,
      undefined,
      undefined,
      to.attackerByNode
    ).map((edge) => {
      const old = oldEdges.get(edge.id)!;
      const changed =
        JSON.stringify([old.style, old.data]) !==
        JSON.stringify([edge.style, edge.data]);
      const cue = plan.routes.get(edge.id)!;
      return {
        ...edge,
        data: {
          ...edge.data,
          history: changed
            ? {
                previous: {
                  style: old.style,
                  dashColors: old.data?.dashColors,
                },
                ...cue,
                slot: index,
                retreat: retreat.routes.get(edge.id),
              }
            : undefined,
        } satisfies RouteEdgeData,
      };
    });
    return { nodes: nextNodes, edges: nextEdges };
  }, [active, frames, index, nodes, edges]);
}
