import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFactionBoard,
  buildNodeBoard,
  buildServerLeaderboard,
  nodeDetails,
  playersFromContributions,
  scoresForNode,
  searchIslands,
} from "./selectors";
import { buildMapEdges, buildMapNodes, matchNodeIds } from "./mapGraph";
import type { Contribution, Faction, Island } from "../types";

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
const contributions: Contribution[] = [
  { nodeId: "1-1", playerId: "p1", name: "One", faction: "a", score: 100 },
  { nodeId: "2-1", playerId: "p1", name: "One", faction: "a", score: 300 },
  { nodeId: "1-1", playerId: "p2", name: "Two", faction: "b", score: 200 },
  {
    nodeId: "2-1",
    playerId: "p3",
    name: "Three",
    faction: "a",
    guild: "G",
    score: 50,
  },
];

test("Node-board rows are the single source of player identity", () => {
  const players = playersFromContributions(contributions);
  assert.deepEqual(
    players.map((p) => [p.id, p.name, p.faction, p.guild]),
    [
      ["p1", "One", "a", undefined],
      ["p2", "Two", "b", undefined],
      ["p3", "Three", "a", "G"],
    ]
  );
});

test("Queries prepare detail and allocation data without mutating the source", () => {
  const details = nodeDetails("1-1", islands, contributions, factions);
  assert.ok(details);
  assert.equal(details.total, 300);
  assert.equal(details.attackers[0]?.player?.name, "Two");
  assert.equal(details.attackers[0]?.factionInfo?.id, "b");
  assert.deepEqual(
    scoresForNode("missing", contributions, factions).map((f) => f.score),
    [0, 0]
  );
  assert.equal(nodeDetails("missing", islands, contributions, factions), null);
  const flagged = nodeDetails(
    "1-1",
    islands,
    contributions,
    factions,
    new Map([["1-1", new Set(["b"])]])
  );
  assert.equal(flagged?.scores.find((f) => f.id === "a")?.connected, false);
  assert.equal(flagged?.scores.find((f) => f.id === "b")?.connected, true);
});
test("Faction board ranks by guild totals and owned islands", () => {
  const board = buildFactionBoard(contributions, factions, islands);
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
test("Guild/player filter matches nodes by contribution; edges dim under filter", () => {
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

test("Server leaderboard keeps server rank/score and joins allocations", () => {
  const rows = [
    { rank: 1, playerId: "p2", name: "Two", faction: "b", score: 900 },
    { rank: 2, playerId: "p1", name: "One", faction: "a", score: 300 },
    // Trên server board nhưng không lọt top-N node nào → allocations rỗng.
    { rank: 3, playerId: "p9", name: "#p9", faction: "a", score: 1 },
  ];
  const board = buildServerLeaderboard(rows, contributions, factions);
  // Thứ tự server giữ nguyên — không sort lại theo score/allocations.
  assert.deepEqual(
    board.map((p) => [p.id, p.score, p.nodes]),
    [
      ["p2", 900, 1],
      ["p1", 300, 2],
      ["p9", 1, 0],
    ]
  );
  assert.equal(board[0].factionInfo?.id, "b");
  // playerAllocations sort theo score giảm dần.
  assert.deepEqual(
    board[1].allocations.map((a) => [a.nodeId, a.score]),
    [
      ["2-1", 300],
      ["1-1", 100],
    ]
  );
});

test("Server faction board uses server guild scores; members derive from rows", () => {
  const live: Contribution[] = [
    {
      nodeId: "1-1",
      playerId: "m1",
      name: "M1",
      faction: "a",
      guild: "Alpha",
      guildId: "1",
      score: 70,
    },
    {
      nodeId: "2-1",
      playerId: "m1",
      name: "M1",
      faction: "a",
      guild: "Alpha",
      guildId: "1",
      score: 30,
    },
    {
      nodeId: "1-1",
      playerId: "m2",
      name: "M2",
      faction: "a",
      guild: "Beta",
      guildId: "2",
      score: 40,
    },
    // Không guildId (không brief) → bucket "Không guild", điểm tự tính.
    { nodeId: "1-1", playerId: "m3", name: "#m3", faction: "a", score: 5 },
    {
      nodeId: "1-1",
      playerId: "x1",
      name: "X1",
      faction: "b",
      guild: "Gamma",
      guildId: "9",
      score: 500,
    },
  ];
  const serverGuilds = {
    a: [
      { guildId: "2", name: "Beta", score: 400 },
      { guildId: "1", name: "Alpha", score: 100 },
    ],
  };
  const board = buildFactionBoard(live, factions, islands, serverGuilds);
  const factionA = board.find((f) => f.id === "a");
  assert.ok(factionA);
  // Điểm phe = tổng guild scores server (không cộng bucket "Không guild").
  assert.equal(factionA.score, 500);
  // Guild rows theo thứ tự + điểm server, bất kể member có bao nhiêu.
  assert.deepEqual(
    factionA.guilds.map((g) => [g.guild, g.score, g.players]),
    [
      ["Beta", 400, 1],
      ["Alpha", 100, 1],
      ["Không guild", 5, 1],
    ]
  );
  // Member list derive từ node rows + briefs (guildId match).
  assert.deepEqual(
    factionA.guilds[1].members.map((m) => [m.id, m.score, m.nodes]),
    [["m1", 100, 2]]
  );
  assert.deepEqual(
    factionA.guilds[0].members.map((m) => [m.id, m.score]),
    [["m2", 40]]
  );
  // Phe không có server guilds → rows rỗng, score 0, mọi member thành strays.
  const factionB = board.find((f) => f.id === "b");
  assert.ok(factionB);
  assert.equal(factionB.score, 0);
  assert.deepEqual(
    factionB.guilds.map((g) => [g.guild, g.score, g.players]),
    [["Không guild", 500, 1]]
  );
});

test("Faction board calculates guild power and supports sorting by power or score", () => {
  const live: Contribution[] = [
    {
      nodeId: "1-1",
      playerId: "p1",
      name: "P1",
      faction: "a",
      guild: "HighPowerLowScore",
      guildId: "g1",
      score: 100,
      power: 30_000_000,
      server: 517,
    },
    {
      nodeId: "1-1",
      playerId: "p2",
      name: "P2",
      faction: "a",
      guild: "LowPowerHighScore",
      guildId: "g2",
      score: 1000,
      power: 5_000_000,
      server: 517,
    },
  ];
  const serverGuilds = {
    a: [
      { guildId: "g2", name: "LowPowerHighScore", score: 1000 },
      { guildId: "g1", name: "HighPowerLowScore", score: 100 },
    ],
  };

  // 1. Default: sort by power
  const boardPower = buildFactionBoard(live, factions, islands, serverGuilds);
  const factionA = boardPower.find((f) => f.id === "a");
  assert.ok(factionA);
  assert.equal(factionA.guilds[0].guild, "HighPowerLowScore");
  assert.equal(factionA.guilds[0].power, 30_000_000);
  assert.equal(factionA.guilds[1].guild, "LowPowerHighScore");
  assert.equal(factionA.guilds[1].power, 5_000_000);

  // 2. Sort by score
  const boardScore = buildFactionBoard(
    live,
    factions,
    islands,
    serverGuilds,
    "score"
  );
  const factionAScore = boardScore.find((f) => f.id === "a");
  assert.ok(factionAScore);
  assert.equal(factionAScore.guilds[0].guild, "LowPowerHighScore");
  assert.equal(factionAScore.guilds[1].guild, "HighPowerLowScore");

  // 3. Player power and server preserved
  const players = playersFromContributions(live);
  assert.equal(players[0].power, 30_000_000);
  assert.equal(players[0].server, 517);
});
