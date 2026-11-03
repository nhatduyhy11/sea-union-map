import test from "node:test";
import assert from "node:assert/strict";
import { factionFilterIds, factionIslandStats } from "./factionIslandStats";
import { scoresForNode } from "../nodeScores";
import { factions } from "../../testFixtures";
import type { CanvasIcon } from "../canvasIcons";
import type { Island } from "../../../types";
import type { IslandBucketStats } from "./types";

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

const stats = (
  islands: Island[],
  icons = new Map<string, CanvasIcon>(),
  frontlines = new Map<
    string,
    { owner: { id: string }; rival: { id: string } }
  >()
) =>
  factionIslandStats(
    "a",
    islands,
    new Map(islands.map((n) => [n.id, scoresForNode(n, [], factions)])),
    icons,
    frontlines
  );

const numbers = ({ count, total, mean, median }: IslandBucketStats) => ({
  count,
  total,
  mean,
  median,
});

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
  assert.deepEqual(numbers(result.owned), {
    count: 3,
    total: 90,
    mean: 30,
    median: 30,
  });
  assert.deepEqual(numbers(result.claimable), {
    count: 2,
    total: 25,
    mean: 12.5,
    median: 12.5,
  });
  assert.deepEqual(numbers(result.below), {
    count: 1,
    total: 4,
    mean: 4,
    median: 4,
  });
  assert.deepEqual(numbers(result.enough), {
    count: 5,
    total: 115,
    mean: 23,
    median: 20,
  });
  assert.equal(result.touched.count, 6);
  assert.equal(result.touched.total, 119);
  assert.equal(result.touched.median, 17.5);
  assert.deepEqual([...result.owned.ids], ["o1", "o2", "o3"]);
  assert.deepEqual([...result.claimable.ids], ["c1", "c2"]);
  assert.deepEqual([...result.below.ids], ["l1"]);
  assert.deepEqual([...result.enough.ids], ["o1", "o2", "o3", "c1", "c2"]);
  assert.deepEqual(
    [...result.touched.ids],
    ["o1", "o2", "o3", "c1", "c2", "l1"]
  );
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
  assert.deepEqual(numbers(result.touched), {
    count: 0,
    total: 0,
    mean: 0,
    median: 0,
  });
  assert.equal(result.touched.ids.size, 0);
});

test("factionIslandStats keeps frontline only where the faction is owner or rival", () => {
  const islands = [
    node("base", "a", { a: 999 }, { base: true }),
    node("f1", "a", { a: 20, b: 15 }),
    node("f2", "b", { a: 12, b: 20 }),
    node("f3", "b", { a: 3, b: 20, c: 15 }),
    node("ob", "a", { a: 50 }),
    node("ob2", "b", { a: 3, b: 50 }),
    node("u1", null, { a: 15 }),
  ];
  const icons = new Map<string, CanvasIcon>([
    ["base", "base"],
    ["f1", "frontline"],
    ["f2", "frontline"],
    ["f3", "frontline"],
    ["ob", "overbuilt"],
    ["ob2", "overbuilt"],
  ]);
  const front = (owner: string, rival: string) => ({
    owner: { id: owner },
    rival: { id: rival },
  });
  const frontlines = new Map([
    ["f1", front("a", "b")],
    ["f2", front("b", "a")],
    // a chỉ có điểm lẻ trên đảo b–c đang giành: không phải giao tranh của a.
    ["f3", front("b", "c")],
  ]);
  const result = stats(islands, icons, frontlines);
  assert.deepEqual([...factionFilterIds(result, "frontline")], ["f1", "f2"]);
  assert.deepEqual([...factionFilterIds(result, "overbuilt")], ["ob"]);
  assert.deepEqual([...factionFilterIds(result, "claimable")], ["f2", "u1"]);
});
