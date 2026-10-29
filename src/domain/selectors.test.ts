import test from "node:test";
import assert from "node:assert/strict";
import {
  buildNodeBoard,
  buildServerLeaderboard,
  nodeDetails,
  playersFromContributions,
  scoresForNode,
  searchIslands,
} from "./selectors";
import { contributions, factions, islands, row } from "./testFixtures";

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

test("Players keep power and server from node rows", () => {
  const players = playersFromContributions([
    row({ playerId: "p1", score: 100, power: 30_000_000, server: 517 }),
  ]);
  assert.equal(players[0].power, 30_000_000);
  assert.equal(players[0].server, 517);
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

test("Node board lists islands by display id with faction breakdowns", () => {
  const board = buildNodeBoard(islands, contributions, factions);
  assert.deepEqual(
    board.map((entry) => [entry.island.id, entry.total]),
    [
      ["1-1", 300],
      ["2-1", 350],
    ]
  );
  assert.equal(board[1].scores.find((f) => f.id === "a")?.score, 350);
  assert.equal(board[1].scores.find((f) => f.id === "b")?.score, 0);
});

test("Node board carries per-node attackers for the expanded row", () => {
  const node = buildNodeBoard(islands, contributions, factions).find(
    (entry) => entry.island.id === "2-1"
  )!;
  // Sort theo điểm đóng góp giảm dần, kèm factionInfo để tô màu phe.
  assert.deepEqual(
    node.attackers.map((a) => [a.playerId, a.score]),
    [
      ["p1", 300],
      ["p3", 50],
    ]
  );
  assert.equal(node.attackers[0]?.factionInfo?.id, "a");
});

test("Search handles whitespace, casing, indexes, empty queries and result limits", () => {
  assert.deepEqual(searchIslands("   ", islands), []);
  assert.equal(searchIslands("đảo", islands).length, 2);
  assert.equal(searchIslands("BIỂN", islands)[0]?.id, "2-1");
  assert.equal(searchIslands("1-1", islands)[0]?.name, "Đảo Gió");
  assert.equal(searchIslands("không có", islands).length, 0);
  assert.equal(searchIslands("đảo", islands, 1).length, 1);
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
