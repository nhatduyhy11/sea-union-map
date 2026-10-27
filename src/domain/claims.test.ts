import test from "node:test";
import assert from "node:assert/strict";
import { deriveClaims } from "./claims";
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
