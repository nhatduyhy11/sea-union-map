import test from "node:test";
import assert from "node:assert/strict";
import { canvasIcons, factionEfforts, type FactionEffort } from "./canvasIcons";
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
const effort = new Map<string, FactionEffort>([
  ["a", { mean: 30, median: 20 }],
  ["b", { mean: 30, median: 20 }],
]);
const scoreMap = (nodes: Island[]) =>
  new Map(nodes.map((n) => [n.id, scoresForNode(n, [], factions)]));
function classify(nodes: Island[], routes: Route[] = [], efforts = effort) {
  const all = [...bases, ...nodes];
  const fronts = frontlineNodes(all, routes, [], factions);
  return canvasIcons(all, routes, scoreMap(all), efforts, fronts);
}
// Láng giềng do phe b own, nối với node đang xét.
const enemy = node("enemy", "b", { b: 10 });
const toEnemy = [{ source: "x", target: "enemy" }];

test("Effort is mean and median of claimable node scores only", () => {
  const nodes = [
    node("n1", "a", { a: 10, b: 5 }),
    node("n2", "a", { a: 30 }),
    node("n3", null, { a: 20, b: 9 }),
    node("n4", "a", { a: 100 }),
    node("n5", "b", { b: 12 }),
    node("n6", "b", { b: 40 }),
    node("n7", "b", { b: 20 }),
  ];
  const result = factionEfforts(nodes, scoreMap(nodes));
  assert.deepEqual(result.get("a"), { mean: 40, median: 25 });
  // Điểm b dưới ngưỡng (5, 9) không vào tử số.
  assert.deepEqual(result.get("b"), { mean: 24, median: 20 });
  const none = [node("n1", "a", { a: 9 })];
  assert.equal(factionEfforts(none, scoreMap(none)).size, 0);
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

test("Top owner under 40% pressure: swords when rival borders, cloud-sun otherwise", () => {
  const x = node("x", "a", { a: 100, b: 40 });
  assert.equal(classify([x, enemy], toEnemy).get("x"), "frontline");
  assert.equal(classify([x]).get("x"), "aftermath");
  // Áp lực thắng biceps dù owner vượt mean.
  assert.equal(
    classify([node("x", "a", { a: 100, b: 39 })]).get("x"),
    "overbuilt"
  );
});

test("Biceps needs the top owner at or above its own mean", () => {
  assert.equal(classify([node("x", "a", { a: 30 })]).get("x"), "overbuilt");
  assert.equal(classify([node("x", "a", { a: 29 })]).get("x"), "plain");
});

test("Outscored owner: gift up to 30%, cloud-sun from 40%, nothing in between", () => {
  assert.equal(
    classify([node("x", "a", { a: 30, b: 100 })]).get("x"),
    "gifted"
  );
  assert.equal(classify([node("x", "a", { a: 35, b: 100 })]).get("x"), "plain");
  assert.equal(
    classify([node("x", "a", { a: 40, b: 100 })]).get("x"),
    "aftermath"
  );
  // Khoảng giữa vẫn xét khiên.
  assert.equal(
    classify([node("x", "a", { a: 17, b: 50 }), enemy], toEnemy).get("x"),
    "defend"
  );
});

test("Shield needs a foreign owned neighbor and a score strictly below median", () => {
  assert.equal(
    classify([node("x", "a", { a: 19, b: 5 }), enemy], toEnemy).get("x"),
    "defend"
  );
  assert.equal(
    classify([node("x", "a", { a: 20 }), enemy], toEnemy).get("x"),
    "plain"
  );
  assert.equal(
    classify(
      [node("x", "a", { a: 19 }), node("enemy", null, { b: 10 })],
      toEnemy
    ).get("x"),
    "plain"
  );
  // Đầu route không tồn tại không tính là phe khác.
  assert.equal(
    classify([node("x", "a", { a: 19 })], toEnemy).get("x"),
    "plain"
  );
});

test("Unknown effort skips biceps and shield; bases always retain faction icons", () => {
  assert.equal(
    classify([node("x", "a", { a: 50 }), enemy], toEnemy, new Map()).get("x"),
    "plain"
  );
  const all = [...bases, node("x", "b", { b: 100 })];
  assert.equal(
    canvasIcons(all, [], scoreMap(all), effort, new Map([["a-base", {}]])).get(
      "a-base"
    ),
    "base"
  );
});
