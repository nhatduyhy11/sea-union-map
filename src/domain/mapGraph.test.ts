import test from "node:test";
import assert from "node:assert/strict";
import { scoresForNode } from "./selectors";
import { buildMapEdges, buildMapNodes, matchNodeIds } from "./mapGraph";
import type { Island } from "../types";
import { contributions, factions, islands } from "./testFixtures";

test("Map projection keeps pinning independent from global stats and filtering", () => {
  const scoresByNode = new Map(
    islands.map((island) => [
      island.id,
      scoresForNode(island, contributions, factions),
    ])
  );
  const nodes = buildMapNodes(
    islands,
    scoresByNode,
    factions,
    {
      selected: "1-1",
      pinned: new Set(["2-1"]),
      showAll: false,
      matched: new Set(["1-1"]),
    },
    { openIsland: () => {}, togglePin: () => {} }
  );
  const byId = new Map(nodes.map((n) => [n.id, n]));
  assert.equal(byId.get("1-1")?.data.active, true);
  assert.equal(byId.get("1-1")?.data.dim, false);
  assert.equal(byId.get("1-1")?.data.pinned, false);
  assert.equal(byId.get("2-1")?.data.pinned, true);
  assert.equal(byId.get("2-1")?.data.dim, true);
  assert.equal(byId.get("2-1")?.zIndex, 10);
  const all = buildMapNodes(
    islands,
    scoresByNode,
    factions,
    { selected: null, pinned: new Set(), showAll: false, matched: null },
    { openIsland: () => {}, togglePin: () => {} }
  );
  assert.equal(
    all.every((node) => !node.data.dim),
    true
  );
});

test("Map projection attaches playerHighlight when filtering by player", () => {
  const scoresByNode = new Map(
    islands.map((island) => [
      island.id,
      scoresForNode(island, contributions, factions),
    ])
  );
  const nodes = buildMapNodes(
    islands,
    scoresByNode,
    factions,
    {
      selected: null,
      pinned: new Set(),
      showAll: true,
      matched: new Set(["1-1"]),
      playerHighlight: {
        faction: "east",
        scoresByNode: new Map([["1-1", 5000]]),
      },
    },
    { openIsland: () => {}, togglePin: () => {} }
  );
  const byId = new Map(nodes.map((n) => [n.id, n]));
  assert.deepEqual(byId.get("1-1")?.data.playerHighlight, {
    faction: "east",
    score: 5000,
  });
  assert.deepEqual(byId.get("2-1")?.data.playerHighlight, {
    faction: "east",
    score: 0,
  });
});

test("Guild/player filter matches nodes by contribution", () => {
  const nodeIdsByGuild = new Map<string, Set<string>>([
    ["G", new Set(["2-1"])],
    ["Không guild", new Set(["1-1", "2-1"])],
  ]);
  const nodeIdsByPlayer = new Map<string, Set<string>>([
    ["p1", new Set(["1-1", "2-1"])],
    ["p2", new Set(["1-1"])],
    ["p3", new Set(["2-1"])],
  ]);
  assert.deepEqual(
    matchNodeIds({ kind: "guild", id: "G" }, nodeIdsByGuild, nodeIdsByPlayer),
    new Set(["2-1"])
  );
  // "Không guild" gộp mọi player không guild — p1 và p2.
  assert.deepEqual(
    matchNodeIds(
      { kind: "guild", id: "Không guild" },
      nodeIdsByGuild,
      nodeIdsByPlayer
    ),
    new Set(["1-1", "2-1"])
  );
  assert.deepEqual(
    matchNodeIds({ kind: "player", id: "p1" }, nodeIdsByGuild, nodeIdsByPlayer),
    new Set(["1-1", "2-1"])
  );
  assert.deepEqual(
    matchNodeIds(
      { kind: "guild", id: "Trống" },
      nodeIdsByGuild,
      nodeIdsByPlayer
    ),
    new Set()
  );
  assert.equal(matchNodeIds(null, nodeIdsByGuild, nodeIdsByPlayer), null);
});

test("Edge stroke prefers faction edgeColor over color", () => {
  const withEdge = [
    {
      id: "a",
      name: "A",
      color: "#123456",
      labelColor: "#0000ff",
      edgeColor: "#cc9a00",
    },
  ];
  const [edge] = buildMapEdges(
    [{ source: "1-1", target: "1-1" }],
    islands,
    withEdge
  );
  assert.equal(edge?.style?.stroke, "#cc9a00");
});

test("Edges style by ownership and dim under filter", () => {
  const neutral: Island = {
    id: "3-9",
    name: "Đảo Trung",
    position: { x: 90, y: 90 },
    owner: null,
    claimThreshold: 1,
  };
  const withNeutral = [...islands, neutral];
  const routes = [
    { source: "3-9", target: "3-9" },
    { source: "3-9", target: "1-1" },
    { source: "1-1", target: "2-1" },
    { source: "1-1", target: "1-1" },
  ];
  const edges = buildMapEdges(routes, withNeutral, factions);
  assert.equal(edges[0]?.style?.strokeDasharray, "7 7");
  assert.equal(edges[1]?.style?.strokeDasharray, "7 7");
  assert.equal(edges[2]?.style?.strokeDasharray, undefined);
  assert.equal(edges[2]?.style?.stroke, "#9caeb9");
  assert.equal(edges[3]?.style?.stroke, "#123456");
  // Edge sở hữu phe đậm + đậm màu; neutral link nhạt (opacity mặc định 0.4
  // từ neutralOpacity) để đỡ rối toàn cảnh.
  assert.equal(edges[3]?.style?.strokeWidth, 3);
  assert.equal(edges[3]?.style?.opacity, 0.7);
  assert.equal(edges[0]?.style?.strokeWidth, 2);
  assert.equal(edges[0]?.style?.opacity, 0.4);
  assert.equal(edges[2]?.style?.opacity, 0.4);
  // Có filter: mọi connection dim xuống để node highlight nổi lên.
  const dimmed = buildMapEdges(routes, withNeutral, factions, true);
  assert.equal(dimmed[3]?.style?.opacity, 0.2);
  assert.equal(dimmed[0]?.style?.opacity, 0.12);
  assert.equal(dimmed[3]?.style?.strokeWidth, 3);
});
