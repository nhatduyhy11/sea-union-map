import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFactionBoard,
  buildLeaderboard,
  buildNodeBoard,
  nodeDetails,
  scoresForNode,
  searchIslands,
} from "./selectors";
import { buildMapEdges, buildMapNodes } from "./mapGraph";
import type { Contribution, Faction, Island, Player } from "../types";

const factions: Faction[] = [
  { id: "a", name: "A", color: "#123456" },
  { id: "b", name: "B", color: "#abcdef" },
];
const islands: Island[] = [
  {
    id: "1-1",
    name: "Đảo Gió",
    position: { x: 0, y: 0 },
    owner: "a",
    boss: null,
    level: 35,
    claimThreshold: 1,
  },
  {
    id: "2-1",
    name: "Đảo Biển",
    position: { x: 50, y: 50 },
    owner: "b",
    boss: null,
    level: 60,
    claimThreshold: 1,
  },
];
const players: Player[] = [
  { id: "p1", name: "One", faction: "a" },
  { id: "p2", name: "Two", faction: "b" },
  { id: "p3", name: "Three", faction: "a", guild: "G" },
];
const contributions: Contribution[] = [
  { nodeId: "1-1", playerId: "p1", faction: "a", score: 100 },
  { nodeId: "2-1", playerId: "p1", faction: "a", score: 300 },
  { nodeId: "1-1", playerId: "p2", faction: "b", score: 200 },
  { nodeId: "2-1", playerId: "p3", faction: "a", score: 50 },
];

test("Queries prepare detail and allocation data without mutating the source", () => {
  const details = nodeDetails("1-1", islands, contributions, players, factions);
  assert.ok(details);
  assert.equal(details.total, 300);
  assert.equal(details.attackers[0]?.player?.name, "Two");
  assert.equal(details.attackers[0]?.factionInfo?.id, "b");
  assert.deepEqual(
    scoresForNode("missing", contributions, factions).map((f) => f.score),
    [0, 0]
  );
  assert.equal(
    nodeDetails("missing", islands, contributions, players, factions),
    null
  );
  const board = buildLeaderboard(players, contributions, factions);
  assert.equal(board[0].id, "p1");
  assert.equal(board[0].score, 400);
  assert.equal(board[0].nodes, 2);
  assert.deepEqual(
    board[0].allocations.map((c) => c.nodeId),
    ["2-1", "1-1"]
  );
  assert.equal(board[1].id, "p2");
  assert.equal(board[1].score, 200);
  const flagged = nodeDetails(
    "1-1",
    islands,
    contributions,
    players,
    factions,
    new Map([["1-1", new Set(["b"])]])
  );
  assert.equal(flagged?.scores.find((f) => f.id === "a")?.connected, false);
  assert.equal(flagged?.scores.find((f) => f.id === "b")?.connected, true);
});
test("Faction board ranks by guild totals and owned islands", () => {
  const board = buildFactionBoard(players, contributions, factions, islands);
  assert.equal(board[0].id, "a");
  assert.equal(board[0].score, 450);
  assert.equal(board[0].islands, 1);
  // Guild rows sort by score; players without a guild share the fallback.
  assert.deepEqual(
    board[0].guilds.map((g) => [g.guild, g.score, g.players]),
    [
      ["Không guild", 400, 1],
      ["G", 50, 1],
    ]
  );
  assert.equal(
    board[0].guilds.reduce((sum, g) => sum + g.score, 0),
    board[0].score
  );
  assert.equal(board[1].id, "b");
  assert.equal(board[1].islands, 1);
  assert.equal(board[1].score, 200);
});
test("Node board ranks islands by total points with faction breakdowns", () => {
  const board = buildNodeBoard(islands, contributions, factions);
  assert.deepEqual(
    board.map((entry) => [entry.island.id, entry.total]),
    [
      ["2-1", 350],
      ["1-1", 300],
    ]
  );
  assert.equal(board[0].scores.find((f) => f.id === "a")?.score, 350);
  assert.equal(board[0].scores.find((f) => f.id === "b")?.score, 0);
});
test("Search handles whitespace, casing, indexes, empty queries and result limits", () => {
  assert.deepEqual(searchIslands("   ", islands), []);
  assert.equal(searchIslands("đảo", islands).length, 2);
  assert.equal(searchIslands("BIỂN", islands)[0]?.id, "2-1");
  assert.equal(searchIslands("1-1", islands)[0]?.name, "Đảo Gió");
  assert.equal(searchIslands("không có", islands).length, 0);
  assert.equal(searchIslands("đảo", islands, 1).length, 1);
});
test("Map projection keeps pinning independent from global stats and filtering", () => {
  const scoresByNode = new Map([
    ["1-1", scoresForNode("1-1", contributions, factions)],
    ["2-1", scoresForNode("2-1", contributions, factions)],
  ]);
  const nodes = buildMapNodes(
    islands,
    scoresByNode,
    factions,
    {
      selected: "1-1",
      pinned: new Set(["2-1"]),
      showAll: false,
      filter: "a",
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
  const edges = buildMapEdges(
    [{ source: "1-1", target: "2-1" }],
    islands,
    factions
  );
  assert.equal(edges[0]?.style?.stroke, "#5d7a8a");
  const sameFactionEdges = buildMapEdges(
    [{ source: "1-1", target: "1-1" }],
    islands,
    factions
  );
  assert.equal(sameFactionEdges[0]?.style?.stroke, "#123456");
});
test("Neutral filter dims owned islands and never highlights edges", () => {
  const neutral: Island = {
    id: "3-9",
    name: "Đảo Trung",
    position: { x: 90, y: 90 },
    owner: null,
    boss: null,
    level: 60,
    claimThreshold: 1,
  };
  const withNeutral = [...islands, neutral];
  const scoresByNode = new Map(
    withNeutral.map((island) => [
      island.id,
      scoresForNode(island.id, contributions, factions),
    ])
  );
  const actions = { openIsland: () => {}, togglePin: () => {} };
  const state = {
    selected: null,
    pinned: new Set<string>(),
    showAll: false,
  };
  const nodes = buildMapNodes(
    withNeutral,
    scoresByNode,
    factions,
    { ...state, filter: "neutral" },
    actions
  );
  const byId = new Map(nodes.map((n) => [n.id, n]));
  assert.equal(byId.get("3-9")?.data.dim, false);
  assert.equal(byId.get("1-1")?.data.dim, true);
  const neutralRoutes = [
    { source: "3-9", target: "3-9" },
    { source: "3-9", target: "1-1" },
    { source: "1-1", target: "2-1" },
  ];
  const resting = buildMapEdges(
    neutralRoutes,
    withNeutral,
    factions,
    "neutral"
  );
  assert.equal(resting[0]?.style?.strokeDasharray, "7 7");
  assert.equal(resting[0]?.style?.opacity, 0.45);
  assert.equal(resting[1]?.style?.strokeDasharray, "7 7");
  assert.equal(resting[2]?.style?.strokeDasharray, undefined);
  assert.equal(
    buildMapEdges(neutralRoutes, withNeutral, factions)[0]?.style
      ?.strokeDasharray,
    "7 7"
  );
  const highlighted = buildMapEdges(
    [{ source: "1-1", target: "1-1" }],
    islands,
    factions,
    "a"
  );
  assert.equal(highlighted[0]?.style?.opacity, 1);
  assert.equal(highlighted[0]?.style?.strokeWidth, 3);
  const dimmed = buildMapEdges(
    [{ source: "1-1", target: "2-1" }],
    islands,
    factions,
    "a"
  );
  assert.equal(dimmed[0]?.style?.opacity, 0.12);
});
