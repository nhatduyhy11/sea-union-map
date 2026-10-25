import test from "node:test";
import assert from "node:assert/strict";
import { deriveClaims } from "./claims";
import { islands as demoIslands, routes, contributions } from "../data/demo";
import type { Contribution, Island, Route } from "../types";

const node = (id: string, owner: string | null = null): Island => ({
  id,
  name: id,
  position: { x: 0, y: 0 },
  owner,
  boss: null,
  level: 1,
  claimThreshold: 1,
});
const base = (id: string, faction: string): Island => ({
  ...node(id, faction),
  base: true,
});
const chain = (ids: string[]): Route[] =>
  ids.slice(1).map((id, i) => ({ source: ids[i] as string, target: id }));
const c = (nodeId: string, faction: string, score: number): Contribution => ({
  nodeId,
  playerId: `${faction}@${nodeId}`,
  name: `${faction}@${nodeId}`,
  faction,
  score,
});
const owner = (state: ReturnType<typeof deriveClaims>, id: string) =>
  state.ownerByNode.get(id);

test("A cut base link suspends the score, so a smaller connected faction claims", () => {
  // base-a — m — n2, base-b tied to m: a outnumbers b at n2 500 to 50 but
  // loses the relay node m, leaving its score suspended at n2.
  const islands = [
    base("base-a", "a"),
    base("base-b", "b"),
    node("m"),
    node("n2"),
  ];
  const routes = [...chain(["base-a", "m", "n2"]), ...chain(["base-b", "m"])];
  const contributions = [c("n2", "a", 500), c("m", "b", 100), c("n2", "b", 50)];
  const claims = deriveClaims(islands, routes, contributions);
  assert.equal(owner(claims, "m"), "b");
  assert.equal(owner(claims, "n2"), "b");
  assert.deepEqual([...(claims.connectedByNode.get("n2") ?? [])], ["b"]);
});

test("Reconnecting the relay restores the suspended score and flips the node", () => {
  const islands = [
    base("base-a", "a"),
    base("base-b", "b"),
    node("m"),
    node("n2"),
  ];
  const routes = [...chain(["base-a", "m", "n2"]), ...chain(["base-b", "m"])];
  const contributions = [
    c("m", "a", 200),
    c("n2", "a", 500),
    c("m", "b", 100),
    c("n2", "b", 50),
  ];
  const claims = deriveClaims(islands, routes, contributions);
  assert.equal(owner(claims, "m"), "a");
  assert.equal(owner(claims, "n2"), "a");
  assert.deepEqual([...(claims.connectedByNode.get("n2") ?? [])], ["a"]);
});

test("A score below the node threshold never claims, an equal one does", () => {
  const low: Island = { ...node("x"), claimThreshold: 10 };
  const equal: Island = { ...node("y"), claimThreshold: 5 };
  const islands = [base("base-a", "a"), low, equal];
  const routes = [...chain(["base-a", "x"]), ...chain(["base-a", "y"])];
  const contributions = [c("x", "a", 5), c("y", "a", 5)];
  const claims = deriveClaims(islands, routes, contributions);
  assert.equal(owner(claims, "x"), null);
  assert.equal(owner(claims, "y"), "a");
});

test("An exact tie between connected factions leaves the node unclaimed", () => {
  const islands = [base("base-a", "a"), base("base-b", "b"), node("x")];
  const routes = [...chain(["base-a", "x"]), ...chain(["base-b", "x"])];
  const contributions = [c("x", "a", 100), c("x", "b", 100)];
  const claims = deriveClaims(islands, routes, contributions);
  assert.equal(owner(claims, "x"), null);
});

test("Demo ownership follows the rule and each territory stays connected", () => {
  const claims = deriveClaims(demoIslands, routes, contributions);
  for (const island of demoIslands) {
    const owner = claims.ownerByNode.get(island.id);
    if (island.base) {
      assert.equal(owner, island.owner, `${island.id} keeps its faction`);
      continue;
    }
    const connected = claims.connectedByNode.get(island.id);
    assert.ok(
      !owner || connected?.has(owner),
      `${island.id} owned by ${owner} without a base link`
    );
  }
  // Progressive claiming means every faction's land forms one piece around
  // its base — no outpost behind neutral or enemy water.
  for (const factionId of new Set(
    [...claims.ownerByNode.values()].filter((id): id is string => Boolean(id))
  )) {
    const start = demoIslands.find(
      (node) => node.base && node.owner === factionId
    );
    assert.ok(start, `${factionId} has a base`);
    const land = [...claims.ownerByNode.entries()]
      .filter(([, owner]) => owner === factionId)
      .map(([id]) => id);
    const adjacent = new Map<string, string[]>();
    for (const route of routes) {
      const push = (from: string, to: string) => {
        const list = adjacent.get(from);
        if (list) list.push(to);
        else adjacent.set(from, [to]);
      };
      push(route.source, route.target);
      push(route.target, route.source);
    }
    const visited = new Set([start.id]);
    const queue = [start.id];
    for (let head = 0; head < queue.length; head++)
      for (const next of adjacent.get(queue[head] as string) ?? [])
        if (!visited.has(next) && claims.ownerByNode.get(next) === factionId) {
          visited.add(next);
          queue.push(next);
        }
    assert.equal(visited.size, land.length, `${factionId} territory split`);
  }
  // The middle of the central axis sits beyond every base's reach.
  assert.equal(claims.ownerByNode.get("4"), null);
});
