import test from "node:test";
import assert from "node:assert/strict";
import { buildFactionBoard } from "./selectors";
import { contributions, factions, islands, row } from "./testFixtures";

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

test("Server faction board uses server guild scores; members derive from rows", () => {
  const live = [
    row({ playerId: "m1", guild: "Alpha", guildId: "1", score: 70 }),
    row({
      nodeId: "2-1",
      playerId: "m1",
      guild: "Alpha",
      guildId: "1",
      score: 30,
    }),
    row({ playerId: "m2", guild: "Beta", guildId: "2", score: 40 }),
    // Không guildId (không brief) → bucket "Không guild", điểm tự tính.
    row({ playerId: "m3", name: "#m3", score: 5 }),
    row({
      playerId: "x1",
      faction: "b",
      guild: "Gamma",
      guildId: "9",
      score: 500,
    }),
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
  // identity (id/guild) = guildId game; name giữ tên hiển thị.
  assert.deepEqual(
    factionA.guilds.map((g) => [g.id, g.name, g.score, g.players]),
    [
      ["2", "Beta", 400, 1],
      ["1", "Alpha", 100, 1],
      ["Không guild", "Không guild", 5, 1],
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
    factionB.guilds.map((g) => [g.id, g.score, g.players]),
    [["Không guild", 500, 1]]
  );
});

test("Faction board calculates guild power and supports sorting by power or score", () => {
  const live = [
    row({
      playerId: "p1",
      guild: "HighPowerLowScore",
      guildId: "g1",
      score: 100,
      power: 30_000_000,
      server: 517,
    }),
    row({
      playerId: "p2",
      guild: "LowPowerHighScore",
      guildId: "g2",
      score: 1000,
      power: 5_000_000,
      server: 517,
    }),
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
  assert.equal(factionA.guilds[0].id, "g1");
  assert.equal(factionA.guilds[0].name, "HighPowerLowScore");
  assert.equal(factionA.guilds[0].power, 30_000_000);
  assert.equal(factionA.guilds[1].id, "g2");
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
  assert.equal(factionAScore.guilds[0].id, "g2");
  assert.equal(factionAScore.guilds[1].id, "g1");

  // 3. Row power (guild brief) thắng bucket power — guild không member trong
  // node board vẫn có power và lên đầu khi sort theo power.
  const boardBrief = buildFactionBoard(live, factions, islands, {
    a: [
      ...serverGuilds.a,
      { guildId: "g3", name: "NoNodeRows", score: 0, power: 50_000_000 },
    ],
  });
  const factionABrief = boardBrief.find((f) => f.id === "a");
  assert.ok(factionABrief);
  assert.equal(factionABrief.guilds[0].id, "g3");
  assert.equal(factionABrief.guilds[0].power, 50_000_000);
  assert.equal(factionABrief.guilds[0].players, 0);
});

test("Faction board keys guilds by game guild id", () => {
  const live = [
    row({
      playerId: "p1",
      guild: "HighPowerLowScore",
      guildId: "g1",
      score: 100,
    }),
    row({
      playerId: "p2",
      guild: "LowPowerHighScore",
      guildId: "g2",
      score: 1000,
    }),
    // guildId không có row server → strays, rơi bucket "Không guild".
    row({ playerId: "p3", guildId: "g9", score: 10 }),
  ];
  const serverGuilds = {
    a: [
      { guildId: "g1", name: "HighPowerLowScore", score: 100 },
      { guildId: "g2", name: "LowPowerHighScore", score: 1000 },
    ],
  };
  const board = buildFactionBoard(live, factions, islands, serverGuilds);
  const guildsA = board.find((f) => f.id === "a")!.guilds;
  // id/guild là guildId từ game; name là display name. Player guildId lạ
  // (g9) và không guildId cùng về bucket "Không guild".
  assert.deepEqual(
    guildsA.map((g) => [g.id, g.name, g.guild]),
    [
      ["g2", "LowPowerHighScore", "g2"],
      ["g1", "HighPowerLowScore", "g1"],
      ["Không guild", "Không guild", "Không guild"],
    ]
  );
});

test("Same-named guilds stay separate rows keyed by guild id", () => {
  const live = [
    row({ playerId: "p1", guild: "HUNTERS", guildId: "g1", score: 100 }),
    row({ playerId: "p2", guild: "HUNTERS", guildId: "g2", score: 200 }),
  ];
  const serverGuilds = {
    a: [
      { guildId: "g1", name: "HUNTERS", score: 100 },
      { guildId: "g2", name: "HUNTERS", score: 200 },
    ],
  };
  const board = buildFactionBoard(live, factions, islands, serverGuilds);
  const guildsA = board.find((f) => f.id === "a")!.guilds;
  assert.deepEqual(
    guildsA.map((g) => [g.id, g.name, g.players]),
    [
      ["g2", "HUNTERS", 1],
      ["g1", "HUNTERS", 1],
    ]
  );
});

test("Faction board carries server fuel; absent fuel stays undefined", () => {
  const live = [
    row({ playerId: "p1", guild: "Alpha", guildId: "g1", score: 100 }),
  ];
  const serverGuilds = {
    a: [{ guildId: "g1", name: "Alpha", score: 100 }],
  };
  const board = buildFactionBoard(
    live,
    factions,
    islands,
    serverGuilds,
    "power",
    { a: 673_961, b: 178_912 }
  );
  assert.equal(board.find((f) => f.id === "a")!.fuel, 673_961);
  assert.equal(board.find((f) => f.id === "b")!.fuel, 178_912);

  // Path computed (không serverGuilds) không có fuel — UI ẩn "(nhiên liệu)".
  const computed = buildFactionBoard(contributions, factions, islands);
  for (const entry of computed) assert.equal(entry.fuel, undefined);
});
