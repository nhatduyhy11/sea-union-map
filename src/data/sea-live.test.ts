import test from "node:test";
import assert from "node:assert/strict";
import raw from "./sea-live.json";
import { contributions, factionDir, islands, layoutIdOf } from "./sea-live";

// Join game-id → layout-id chạy trong sea-live.ts, dữ liệu từ sea-live.json
// (Python dump thuần). Test này khoá hợp đồng của join để re-crawl đè JSON
// không lọt data lệch layout.
test("layoutIdOf reads the trailing display-id prefix", () => {
  assert.equal(layoutIdOf({ name: "1-23Đảo Câu Cá", type: 2, pointRequire: 0 }), "1-23");
  assert.equal(
    layoutIdOf({ name: "Khu nghỉ dưỡng Trường Đảo 3-2", type: 4, pointRequire: 0 }),
    "3-2"
  );
  assert.equal(layoutIdOf({ name: "4-1Khách Sạn Cực Lạc", type: 5, pointRequire: 0 }), "4");
  assert.equal(layoutIdOf({ name: "Vịnh Thao Thiết", type: 1, pointRequire: 0 }), null);
});

test("Every non-base island joins exactly one camp and vice versa", () => {
  const dump = raw as {
    camp: Record<string, { name: string; type: number; pointRequire: number }>;
  };
  const layoutIdByGame = new Map(
    Object.values(dump.camp)
      .map((camp) => [layoutIdOf(camp), camp.name] as const)
      .filter(([layoutId]) => layoutId !== null)
  );
  assert.equal(layoutIdByGame.size, Object.keys(dump.camp).length - 4); // trừ 4 base (type 1)

  const nonBase = islands.filter((node) => !node.base);
  assert.equal(nonBase.length, layoutIdByGame.size);
  for (const node of nonBase) {
    assert.ok(layoutIdByGame.has(node.id), `island ${node.id} không có camp`);
    assert.equal(node.name, layoutIdByGame.get(node.id));
    assert.ok(node.claimThreshold > 1, `${node.id} mất pointRequire`);
  }
});

test("Four bases own one direction each; every faction resolves to a direction", () => {
  const dump = raw as {
    camp: Record<string, { name: string; type: number }>;
    owner: Record<string, number>;
    baseDir: Record<string, string>;
  };
  const dirs = new Set(Object.values(dump.baseDir));
  assert.deepEqual([...dirs].sort(), ["east", "north", "south", "west"]);
  for (const [name, dir] of Object.entries(dump.baseDir)) {
    const camp = Object.entries(dump.camp).find(([, c]) => c.name === name);
    assert.ok(camp, `base ${name} không nằm trong camp`);
    assert.equal(camp[1].type, 1);
    assert.equal(factionDir[dump.owner[camp[0]]], dir);
  }
  // faction 1..4 đều có hướng — ngược lại contribution không biết thuộc phe nào.
  assert.deepEqual(
    Object.keys(factionDir).map(Number).sort(),
    [1, 2, 3, 4]
  );
});

test("Every valid board row becomes one contribution on a known island", () => {
  const validRows = (raw.nodeRows as [number, number, number, number][]).filter(
    ([, , , camp]) => factionDir[camp]
  );
  assert.equal(contributions.length, validRows.length);
  const islandIds = new Set(islands.map((node) => node.id));
  for (const entry of contributions) {
    assert.ok(islandIds.has(entry.nodeId), `nodeId ${entry.nodeId} lạ`);
    assert.ok(Object.values(factionDir).includes(entry.faction));
    assert.match(entry.name, /^(#|\S)/);
  }
  // Player không brief hiển thị #id, không mất dòng.
  const briefIds = new Set(Object.keys(raw.briefs));
  const anonymous = contributions.filter((c) => !briefIds.has(c.playerId));
  assert.ok(anonymous.length > 0);
  for (const entry of anonymous) assert.equal(entry.name, `#${entry.playerId}`);
});
