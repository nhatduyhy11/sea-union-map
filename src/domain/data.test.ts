import test from "node:test";
import assert from "node:assert/strict";
import {
  layoutNodes as islands,
  layoutRoutes as routes,
} from "../data/map-layout";

const at = (id: string) => {
  const found = islands.find((n) => n.id === id);
  if (!found) throw new Error(`Island ${id} not found`);
  return found.position;
};
test("Map has unique nodes, four unclaimable bases, and valid routes", () => {
  const ids = new Set(islands.map((n) => n.id));
  assert.equal(ids.size, islands.length);
  assert.equal(islands.filter((n) => n.base).length, 4);
  assert.equal(islands.length, 89);
  for (let index = 1; index <= 24; index++) assert.ok(ids.has(`1-${index}`));
  for (let index = 1; index <= 52; index++) assert.ok(ids.has(`2-${index}`));
  for (let index = 1; index <= 8; index++) assert.ok(ids.has(`3-${index}`));
  assert.ok(ids.has("4"));
  for (const n of islands)
    assert.match(n.id, /^(?:base-(?:north|east|south|west)|4|[123]-\d{1,2})$/);
  for (const r of routes) {
    assert.ok(ids.has(r.source));
    assert.ok(ids.has(r.target));
    assert.notEqual(r.source, r.target);
  }
  const visited = new Set([islands[0].id]);
  for (let i = 0; i < islands.length; i++)
    for (const r of routes) {
      if (visited.has(r.source)) visited.add(r.target);
      if (visited.has(r.target)) visited.add(r.source);
    }
  assert.equal(visited.size, islands.length);
});
test("Screenshot landmarks use the central axis and matching opposite sectors", () => {
  assert.deepEqual(at("4"), { x: 0, y: 0 });
  for (const node of islands.filter((n) => n.central))
    assert.equal(node.position.y, 0);
  assert.equal(islands.filter((n) => n.central).length, 9);
  for (const [left, right] of [
    ["1-24", "1-4"],
    ["1-22", "1-15"],
    ["2-32", "2-18"],
    ["2-30", "2-6"],
  ]) {
    assert.equal(at(left).x, -at(right).x);
    assert.equal(at(left).y, at(right).y);
  }
  assert.equal(at("base-west").y, at("base-east").y);
  assert.equal(at("base-north").x, at("base-south").x);
});
test("Islands confirmed by the owner sit exactly on their vertical columns", () => {
  // Each group shares one x — the columns the debug perpendiculars draw.
  for (const group of [
    ["1-17", "1-21"],
    ["1-9", "1-1", "1-3"],
    ["2-41", "2-50", "2-21", "2-24"],
    ["2-46", "3-7", "2-17"],
    ["2-11", "2-40", "2-39", "3-5", "2-31", "2-8"],
    ["2-15", "2-22", "3-3"],
    ["2-19", "2-44", "3-4"],
    ["2-33", "3-8", "2-3"],
    ["2-16", "2-42", "2-43", "3-6", "2-9", "2-27", "2-1"],
    ["2-45", "2-37", "2-2", "2-26"],
  ])
    for (const id of group)
      assert.equal(at(id).x, at(group[0]).x, `${id} is off its column`);
  // West columns and their east mirrors are symmetric about "4".
  for (const [left, right] of [
    ["2-41", "2-45"],
    ["2-50", "2-37"],
    ["2-21", "2-2"],
    ["2-24", "2-26"],
    ["2-15", "2-19"],
    ["2-22", "2-44"],
    ["3-7", "3-8"],
    ["3-5", "3-6"],
    ["3-3", "3-4"],
  ])
    assert.equal(at(left).x, -at(right).x, `${left}/${right} not mirrored`);
});
