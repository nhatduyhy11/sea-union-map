import test from "node:test";
import assert from "node:assert/strict";
import { factionIslandStats } from "./factionIslandStats";
import { scoresForNode } from "../nodeScores";
import { factions } from "../../testFixtures";
import type { Island } from "../../../types";

const node = (
  id: string,
  owner: string | null,
  scores: Record<string, number>,
  extra: Partial<Island> = {}
): Island => ({
  id,
  owner,
  factionScores: scores,
  claimThreshold: 10,
  name: id,
  position: { x: 0, y: 0 },
  ...extra,
});

const stats = (islands: Island[]) =>
  factionIslandStats(
    "a",
    islands,
    new Map(islands.map((n) => [n.id, scoresForNode(n, [], factions)]))
  );

test("factionIslandStats splits owned / claimable / below and combines", () => {
  const result = stats([
    node("base", "a", { a: 999 }, { base: true }),
    node("o1", "a", { a: 20 }),
    node("o2", "a", { a: 40 }),
    node("o3", "a", { a: 30 }),
    node("c1", "b", { a: 15, b: 30 }),
    node("c2", null, { a: 10 }),
    node("l1", "b", { a: 4, b: 20 }),
    node("none", "b", { b: 20 }),
  ]);
  assert.deepEqual(result.owned, { count: 3, total: 90, mean: 30, median: 30 });
  assert.deepEqual(result.claimable, {
    count: 2,
    total: 25,
    mean: 12.5,
    median: 12.5,
  });
  assert.deepEqual(result.below, { count: 1, total: 4, mean: 4, median: 4 });
  assert.deepEqual(result.enough, {
    count: 5,
    total: 115,
    mean: 23,
    median: 20,
  });
  assert.equal(result.touched.count, 6);
  assert.equal(result.touched.total, 119);
  assert.equal(result.touched.median, 17.5);
  assert.deepEqual(
    result.enoughIslands.map(({ id, points, owned }) => [id, points, owned]),
    [
      ["c2", 10, false],
      ["c1", 15, false],
      ["o1", 20, true],
      ["o3", 30, true],
      ["o2", 40, true],
    ]
  );
});

test("factionIslandStats returns zeroed buckets when nothing matches", () => {
  const result = stats([node("x", "b", { b: 20 })]);
  assert.deepEqual(result.touched, { count: 0, total: 0, mean: 0, median: 0 });
});
