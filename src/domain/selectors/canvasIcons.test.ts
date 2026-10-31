import test from "node:test";
import assert from "node:assert/strict";
import { canvasIcons, factionEfforts } from "./canvasIcons";
import { defendNodes } from "./defend";
import { frontlineNodes } from "./frontline";
import { scoresForNode } from "./nodeScores";
import { factions } from "../testFixtures";
import type { Island, Route } from "../../types";

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
const bases = [
  node("a-base", "a", {}, { base: true }),
  node("b-base", "b", {}, { base: true }),
];
const effort = new Map([
  ["a", 10],
  ["b", 10],
]);
function classify(nodes: Island[], routes: Route[] = [], efforts = effort) {
  const all = [...bases, ...nodes];
  const scores = new Map(
    all.map((n) => [n.id, scoresForNode(n, [], factions)])
  );
  const fronts = frontlineNodes(all, routes, [], factions);
  const defend = defendNodes(all, routes, [], factions, fronts, efforts);
  return canvasIcons(all, routes, scores, efforts, fronts, defend);
}

test("Effort uses the board total and pure claimable count; zero denominator stays undefined", () => {
  const result = factionEfforts([
    { id: "a", score: 100, claimable: 4 },
    { id: "b", score: 100, claimable: 0 },
    { id: "c", score: 0, claimable: 0 },
  ]);
  assert.deepEqual([...result], [["a", 25]]);
});

test("Untouched nodes keep geographic icons; positive points split neutral sword and scissors", () => {
  const result = classify([
    node("empty", null, {}),
    node("4", null, {}, { central: true }),
    node("low", null, { a: 9, b: 1 }),
    node("frozen", null, { a: 10, b: 30 }),
  ]);
  assert.deepEqual(
    [...result],
    [
      ["a-base", "base"],
      ["b-base", "base"],
      ["empty", "anchor"],
      ["4", "castle"],
      ["low", "belowClaim"],
      ["frozen", "frozen"],
    ]
  );
});

test("A claimable neutral faction connected from base keeps fallback icon without inventing ownership", () => {
  const nodes = [
    node("bridge", "a", { a: 10 }),
    node("target", null, { a: 10, b: 10 }),
  ];
  const routes = [
    { source: "a-base", target: "bridge" },
    { source: "bridge", target: "target" },
  ];
  assert.equal(classify(nodes, routes).get("target"), "anchor");
  assert.equal(nodes[1].owner, null);
  assert.equal(classify(nodes, routes.slice(1)).get("target"), "frozen");
  assert.equal(
    classify(nodes, [{ source: "a-base", target: "target" }]).get("target"),
    "anchor"
  );
});

test("Gift requires a cut-off claimable rival strictly above owner and at least twice rival effort", () => {
  assert.equal(classify([node("x", "a", { a: 10, b: 20 })]).get("x"), "gifted");
  assert.equal(classify([node("x", "a", { a: 10, b: 19 })]).get("x"), "plain");
  assert.equal(classify([node("x", "a", { a: 20, b: 20 })]).get("x"), "plain");
  const nodes = [
    node("x", "a", { a: 10, b: 20 }),
    node("bridge", "b", { b: 10 }),
  ];
  const routes = [
    { source: "x", target: "bridge" },
    { source: "b-base", target: "bridge" },
  ];
  assert.equal(classify(nodes, routes).get("x"), "frontline");
  // An isolated owned neighbor is not enough to restore the path to base.
  const scores = new Map(
    nodes.map((n) => [n.id, scoresForNode(n, [], factions)])
  );
  assert.equal(
    canvasIcons(
      [...bases, ...nodes],
      routes.slice(0, 1),
      scores,
      effort,
      new Map(),
      new Set()
    ).get("x"),
    "gifted"
  );
});

test("Biceps starts at three times owner effort and a higher cut-off rival blocks it even without gift", () => {
  assert.equal(classify([node("x", "a", { a: 29 })]).get("x"), "plain");
  assert.equal(classify([node("x", "a", { a: 30 })]).get("x"), "overbuilt");
  assert.equal(
    classify([node("x", "a", { a: 30, b: 30 })]).get("x"),
    "overbuilt"
  );
  const unequal = new Map([
    ["a", 10],
    ["b", 20],
  ]);
  assert.equal(
    classify([node("x", "a", { a: 30, b: 35 })], [], unequal).get("x"),
    "plain"
  );
  assert.equal(
    classify([node("x", "a", { a: 30, b: 40 })], [], unequal).get("x"),
    "gifted"
  );
});

test("Shield beats gift, requires a foreign owned neighbor, and uses a strict effort boundary", () => {
  const nodes = [
    node("x", "a", { a: 9, b: 20 }),
    node("enemy", "b", { b: 10 }),
  ];
  // Highest-scoring rival b is cut off at x. A third faction borders x.
  const c = { id: "c", name: "C", color: "#ccc", labelColor: "#333" };
  const all = [...bases, nodes[0], node("enemy", "c", { c: 10 })];
  const scores = new Map(
    all.map((n) => [n.id, scoresForNode(n, [], [...factions, c])])
  );
  const routes = [{ source: "x", target: "enemy" }];
  const fronts = frontlineNodes(all, routes, [], [...factions, c]);
  const defend = defendNodes(all, routes, [], [...factions, c], fronts, effort);
  assert.equal(
    canvasIcons(all, routes, scores, effort, fronts, defend).get("x"),
    "defend"
  );
  assert.equal(
    classify([node("x", "a", { a: 10 }), nodes[1]], routes).get("x"),
    "plain"
  );
  assert.equal(
    classify(
      [node("x", "a", { a: 9 }), node("enemy", null, { b: 10 })],
      routes
    ).get("x"),
    "plain"
  );
  // Missing route endpoint must not count as a foreign owner.
  assert.equal(classify([node("x", "a", { a: 9 })], routes).get("x"), "plain");
});

test("Unknown effort skips dependent icons; bases always retain faction icons", () => {
  assert.equal(
    classify([node("x", "a", { a: 50, b: 100 })], [], new Map()).get("x"),
    "plain"
  );
  const nodes = [...bases, node("x", "b", { b: 100 })];
  const scores = new Map(
    nodes.map((n) => [n.id, scoresForNode(n, [], factions)])
  );
  assert.equal(
    canvasIcons(
      nodes,
      [],
      scores,
      effort,
      new Map([["a-base", {}]]),
      new Set(["a-base"])
    ).get("a-base"),
    "base"
  );
});
