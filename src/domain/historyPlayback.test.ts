import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  historyDays,
  historyOrigin,
  planHistoryGrowth,
  planHistoryRetreat,
  planHistoryTransition,
  validateHistoryDump,
} from "./historyPlayback";
import { buildMapData } from "./mapData";
import type { SeaLiveDump } from "../data/sea-live";

function dump(day: string, server: string): SeaLiveDump {
  const snapshot = JSON.parse(
    readFileSync(
      new URL(`../data/snapshots/${day}/${server}.json`, import.meta.url),
      "utf8"
    )
  );
  const info = JSON.parse(
    readFileSync(
      new URL(
        `../data/event-cache/${snapshot.eventStart}/${server}/info.json`,
        import.meta.url
      ),
      "utf8"
    )
  );
  return {
    ...snapshot,
    ...Object.fromEntries(
      ["guildRoster", "guildNames", "guildPower", "briefs"].map((key) => [
        key,
        info[key],
      ])
    ),
  };
}

test("playlist stays inside its round, excludes future days and marks gaps without inventing snapshots", () => {
  const { days, missing } = historyDays("261026", "261030", (day) =>
    ["261025", "261028", "261030", "261101"].includes(day)
  );
  assert.deepEqual(days, ["261028", "261030"]);
  assert.deepEqual(missing, ["261026", "261027", "261029"]);
  assert.deepEqual(
    historyDays("261116", "261115", () => true),
    { days: [], missing: [] }
  );
});

test("all stored snapshots have stable base identities within each event/server", () => {
  const mappings = new Map<string, string>();
  const root = new URL("../data/snapshots/", import.meta.url);
  for (const day of readdirSync(root).filter((entry) =>
    /^\d{6}$/.test(entry)
  )) {
    for (const file of readdirSync(new URL(`${day}/`, root)).filter((entry) =>
      entry.endsWith(".json")
    )) {
      const server = file.replace(".json", "");
      const data = dump(day, server);
      const key = `${data.eventStart}/${server}`;
      const mapping = validateHistoryDump(data, server, data.eventStart);
      if (mappings.has(key)) assert.equal(mapping, mappings.get(key));
      mappings.set(key, mapping);
    }
  }
});

test("invalid context and unknown owners fail instead of appearing neutral", () => {
  const data = dump("261028", "517");
  assert.throws(() => validateHistoryDump(data, "497", "261026"));
  assert.throws(() => validateHistoryDump(data, "517", "261116"));
  assert.throws(() =>
    validateHistoryDump(
      { ...data, owner: { ...data.owner, bad: 999 } },
      "517",
      "261026"
    )
  );
  assert.throws(() =>
    validateHistoryDump({ ...data, baseDir: {} }, "517", "261026")
  );
  assert.throws(() =>
    validateHistoryDump({ ...data, camp: {} }, "517", "261026")
  );
  assert.throws(() =>
    validateHistoryDump({ ...data, owner: {} }, "517", "261026")
  );
});

test("real capture/loss/switch fixture keeps four bases unchanged and handles disconnected owners", () => {
  const from = buildMapData(dump("261028", "517"));
  const to = buildMapData(dump("261029", "517"));
  const counts = { claim: 0, loss: 0, switch: 0 };
  for (const node of to.ownedIslands) {
    const old = from.ownedIslands.find((other) => other.id === node.id)!;
    if (node.base) {
      assert.equal(node.owner, old.owner);
      assert.deepEqual(node.position, old.position);
    } else if (old.owner !== node.owner)
      counts[
        old.owner === null ? "claim" : node.owner === null ? "loss" : "switch"
      ]++;
  }
  assert.deepEqual(counts, { claim: 7, loss: 4, switch: 6 });
  const isolated = { ...to, routes: [] };
  const plan = planHistoryGrowth(historyOrigin(isolated), isolated);
  assert.equal(plan.routes.size, 0);
  assert.equal(
    isolated.ownedIslands.filter((node) => node.owner).length,
    to.ownedIslands.filter((node) => node.owner).length
  );
  for (const cue of [...plan.nodes.values(), ...plan.routes.values()]) {
    assert.ok(cue.delay + cue.duration < 2700);
  }
});

test("first day starts with four bases and schedules every claimed node and owned edge", () => {
  const target = buildMapData(dump("261028", "517"));
  const origin = historyOrigin(target);
  assert.equal(origin.ownedIslands.filter((node) => node.owner).length, 4);
  assert.deepEqual(
    origin.ownedIslands.filter((node) => node.base),
    target.ownedIslands.filter((node) => node.base)
  );
  const plan = planHistoryGrowth(origin, target);
  for (const node of target.ownedIslands.filter(
    (node) => !node.base && node.owner
  )) {
    assert.ok(plan.nodes.get(node.id)!.delay > 300);
  }
  const byId = new Map(target.ownedIslands.map((node) => [node.id, node]));
  for (const route of target.routes) {
    const a = byId.get(route.source)!,
      b = byId.get(route.target)!;
    if (!a.owner || a.owner !== b.owner) continue;
    const cue = plan.routes.get(`${route.source}__${route.target}`)!;
    assert.ok(cue.duration > 0);
    assert.ok(cue.delay + cue.duration < 2700);
  }
});

test("wave reaches an island before its icon, then continues along the next edge; retained territory seeds the next day", () => {
  const target = buildMapData(dump("261028", "517"));
  const template = target.ownedIslands.find((node) => !node.base)!;
  const chain = {
    ...target,
    ownedIslands: [
      { ...template, id: "base-a", base: true, owner: "a" },
      { ...template, id: "one", base: false, owner: "a" },
      { ...template, id: "two", base: false, owner: "a" },
      { ...template, id: "branch", base: false, owner: "a" },
    ],
    routes: [
      { source: "base-a", target: "one" },
      { source: "two", target: "one" },
      { source: "one", target: "branch" },
    ],
  };
  const intro = planHistoryGrowth(historyOrigin(chain), chain);
  const first = intro.routes.get("base-a__one")!;
  const one = intro.nodes.get("one")!;
  const second = intro.routes.get("two__one")!;
  const two = intro.nodes.get("two")!;
  assert.equal(first.delay + first.duration, one.delay);
  assert.ok(second.delay >= one.delay + one.duration - 0.001);
  assert.ok(Math.abs(second.delay + second.duration - two.delay) < 0.001);
  assert.equal(second.reverse, true);
  assert.deepEqual(two, intro.nodes.get("branch"));
  const previous = {
    ...chain,
    ownedIslands: chain.ownedIslands.map((node) =>
      node.id === "two" || node.id === "branch"
        ? { ...node, owner: null }
        : node
    ),
  };
  const next = planHistoryGrowth(previous, chain);
  assert.equal(next.routes.get("two__one")!.delay, 300);
  assert.ok(next.nodes.get("two")!.delay > 300);
});

test("all daily route and icon transitions fit before the hold at every saved day", () => {
  const root = new URL("../data/snapshots/", import.meta.url);
  const groups = new Map<string, ReturnType<typeof buildMapData>>();
  for (const day of readdirSync(root)
    .filter((entry) => /^\d{6}$/.test(entry))
    .sort()) {
    for (const file of readdirSync(new URL(`${day}/`, root)).filter((entry) =>
      entry.endsWith(".json")
    )) {
      const data = dump(day, file.replace(".json", ""));
      const model = buildMapData(data),
        key = `${data.eventStart}/${data.server}`;
      const previous = groups.get(key) ?? historyOrigin(model);
      const plan = planHistoryGrowth(previous, model);
      const retreat = planHistoryRetreat(previous, model);
      const concurrent = planHistoryTransition(previous, model);
      for (const cue of [
        ...concurrent.growth.nodes.values(),
        ...concurrent.growth.routes.values(),
        ...concurrent.retreat.nodes.values(),
        ...concurrent.retreat.routes.values(),
      ])
        assert.ok(
          cue.delay + cue.duration <= 2600.001,
          `${day}/${data.server} concurrent`
        );

      for (const cue of [
        ...retreat.nodes.values(),
        ...retreat.routes.values(),
      ]) {
        assert.ok(
          cue.delay >= 0 &&
            cue.duration > 0 &&
            cue.delay + cue.duration <= 2400.001,
          `${day}/${data.server} retreat`
        );
      }
      for (const cue of [...plan.nodes.values(), ...plan.routes.values()]) {
        assert.ok(cue.delay + cue.duration < 2700, `${day}/${data.server}`);
      }
      groups.set(key, model);
    }
  }
});

test("loss retracts outer icons and paths toward retained territory, one hop at a time", () => {
  const template = buildMapData(dump("261028", "517"));
  const node = template.ownedIslands.find((item) => !item.base)!;
  const before = {
    ...template,
    ownedIslands: [
      { ...node, id: "base-a", base: true, owner: "a" },
      { ...node, id: "inner", base: false, owner: "a" },
      { ...node, id: "outer", base: false, owner: "a" },
    ],
    routes: [
      { source: "base-a", target: "inner" },
      { source: "outer", target: "inner" },
    ],
  };
  const after = historyOrigin(before);
  const plan = planHistoryRetreat(before, after);
  const outer = plan.nodes.get("outer")!,
    inner = plan.nodes.get("inner")!;
  const farEdge = plan.routes.get("outer__inner")!,
    homeEdge = plan.routes.get("base-a__inner")!;
  assert.equal(outer.delay, 300);
  assert.ok(farEdge.delay >= outer.delay + outer.duration);
  assert.equal(farEdge.delay + farEdge.duration, inner.delay);
  assert.ok(homeEdge.delay >= inner.delay + inner.duration);
  assert.equal(homeEdge.delay + homeEdge.duration, 1700);
  assert.equal(farEdge.reverse, true);
  assert.equal(homeEdge.reverse, false);
  assert.equal(plan.nodes.has("base-a"), false);
});

test("every real loss or ownership switch gets a retreat cue; all lost owned routes retract on the shared day timeline", () => {
  const before = buildMapData(dump("261028", "517"));
  const after = buildMapData(dump("261029", "517"));
  const plan = planHistoryRetreat(before, after);
  assert.equal(plan.nodes.size, 10);
  const old = new Map(before.ownedIslands.map((node) => [node.id, node]));
  let lostOwnedRoutes = 0;
  for (const route of before.routes) {
    const a = old.get(route.source)!,
      b = old.get(route.target)!;
    if (
      !a.owner ||
      a.owner !== b.owner ||
      (!plan.nodes.has(a.id) && !plan.nodes.has(b.id))
    )
      continue;
    lostOwnedRoutes++;
    const cue = plan.routes.get(`${route.source}__${route.target}`)!;
    assert.ok(cue);
    assert.ok(cue.duration > 0);
    assert.ok(cue.delay + cue.duration <= 2400.001);
  }
  assert.ok(lostOwnedRoutes > 0);
});

test("opposing factions advance and retreat together on the captured connection", () => {
  const model = buildMapData(dump("261028", "517"));
  const node = model.ownedIslands.find((item) => !item.base)!;
  const before = {
    ...model,
    ownedIslands: [
      { ...node, id: "base-a", base: true, owner: "a" },
      { ...node, id: "inner", base: false, owner: "a" },
      { ...node, id: "outer", base: false, owner: "a" },
      { ...node, id: "base-b", base: true, owner: "b" },
    ],
    routes: [
      { source: "base-a", target: "inner" },
      { source: "inner", target: "outer" },
      { source: "outer", target: "base-b" },
    ],
  };
  const after = {
    ...before,
    ownedIslands: before.ownedIslands.map((item) =>
      item.base ? item : { ...item, owner: "b" }
    ),
  };
  const { growth, retreat } = planHistoryTransition(before, after);
  assert.deepEqual(growth.nodes.get("outer"), retreat.nodes.get("outer"));
  assert.deepEqual(growth.nodes.get("inner"), retreat.nodes.get("inner"));
  const claimEdge = growth.routes.get("inner__outer")!,
    lossEdge = retreat.routes.get("inner__outer")!;
  assert.equal(claimEdge.delay, lossEdge.delay);
  assert.equal(claimEdge.duration, lossEdge.duration);
  assert.notEqual(claimEdge.reverse, lossEdge.reverse);
  assert.ok(
    claimEdge.delay >=
      growth.nodes.get("outer")!.delay + growth.nodes.get("outer")!.duration
  );
});

test("real claim and retreat overlap, capture layers never disappear before the new owner arrives, neutral losses hand off locally", () => {
  const before = buildMapData(dump("261028", "517")),
    after = buildMapData(dump("261029", "517"));
  const plan = planHistoryTransition(before, after);
  const old = new Map(before.ownedIslands.map((node) => [node.id, node]));
  const next = new Map(after.ownedIslands.map((node) => [node.id, node]));
  const claims = after.routes
    .filter((route) => {
      const a = next.get(route.source)!,
        b = next.get(route.target)!;
      return (
        a.owner &&
        a.owner === b.owner &&
        (a.owner !== old.get(a.id)?.owner || b.owner !== old.get(b.id)?.owner)
      );
    })
    .map((route) =>
      plan.growth.routes.get(`${route.source}__${route.target}`)!
    );
  const overlaps = claims.some((claim) =>
    [...plan.retreat.routes.values()].some(
      (loss) =>
        Math.min(claim.delay + claim.duration, loss.delay + loss.duration) -
          Math.max(claim.delay, loss.delay) >
        10
    )
  );
  assert.equal(overlaps, true);
  for (const [id, loss] of plan.retreat.nodes) {
    const claim = plan.growth.nodes.get(id)!;
    if (next.get(id)?.owner) assert.ok(loss.delay >= claim.delay);
    else assert.deepEqual(loss, claim);
  }
  for (const cue of [
    ...plan.growth.nodes.values(),
    ...plan.growth.routes.values(),
    ...plan.retreat.nodes.values(),
    ...plan.retreat.routes.values(),
  ])
    assert.ok(cue.delay + cue.duration <= 2600.001);
});
