import test from "node:test";
import assert from "node:assert/strict";
import { buildFactionBoard } from "./factionBoard";
import type { Contribution, Faction, Island } from "../../../types";

const faction: Faction = {
  id: "a",
  name: "Faction A",
  color: "#000000",
  labelColor: "#000000",
};

function island(id: string, overrides: Partial<Island> = {}): Island {
  return {
    id,
    name: id,
    position: { x: 0, y: 0 },
    owner: null,
    claimThreshold: 100,
    ...overrides,
  };
}

function contribution(nodeId: string, score: number): Contribution {
  return { nodeId, score, faction: "a", playerId: "p", name: "Player" };
}

for (const serverGuilds of [undefined, { a: [] }]) {
  const path = serverGuilds ? "server guilds" : "computed guilds";
  test(`${path}: counts owned, claimable and touched independently`, () => {
    const nodes = [
      island("base", {
        owner: "a",
        base: true,
        claimThreshold: 0,
        factionScores: {},
      }),
      island("owned", { owner: "a", factionScores: { a: 100 } }),
      island("outbid", { owner: "b", factionScores: { a: 120, b: 150 } }),
      island("cutOff", { factionScores: { a: 100 } }),
      island("below", { factionScores: { a: 99 } }),
      island("empty", { factionScores: {} }),
    ];
    // Server scores override conflicting or absent capped contribution rows.
    const rows = [contribution("below", 500), contribution("empty", 500)];
    const [entry] = buildFactionBoard(rows, [faction], nodes, serverGuilds);
    // Base owned by the faction is not counted as a held island.
    assert.equal(entry.islands, 1);
    assert.equal(entry.claimable, 3);
    assert.equal(entry.touched, 4);
  });
}

test("missing server scores: sums contributions per node and ignores zero points", () => {
  const nodes = [
    island("owned", { owner: "a" }),
    island("below"),
    island("zero"),
  ];
  const rows = [
    contribution("owned", 40),
    contribution("owned", 60),
    contribution("below", 99),
    contribution("zero", 0),
  ];
  const [entry] = buildFactionBoard(rows, [faction], nodes);
  assert.equal(entry.islands, 1);
  assert.equal(entry.claimable, 1);
  assert.equal(entry.touched, 2);
});
