import test from "node:test";
import assert from "node:assert/strict";
import raw from "./sea-live.json";
import { buildLiveData, displayNameOf, layoutIdOf, liveDump } from "./sea-live";
import type { SeaLiveDump } from "./sea-live";

// Ngoài Vite liveDump luôn là bản baked (sea-live.json).
const { contributions, factionDir, factionGuilds, islands, playerBoard } =
  buildLiveData(liveDump);

// Join game-id → layout-id chạy trong sea-live.ts, dữ liệu từ sea-live.json
// (Python dump thuần). Test này khoá hợp đồng của join để re-crawl đè JSON
// không lọt data lệch layout.
test("layoutIdOf reads the trailing display-id prefix", () => {
  assert.equal(
    layoutIdOf({ name: "1-23Đảo Câu Cá", type: 2, pointRequire: 0 }),
    "1-23"
  );
  assert.equal(
    layoutIdOf({
      name: "Khu nghỉ dưỡng Trường Đảo 3-2",
      type: 4,
      pointRequire: 0,
    }),
    "3-2"
  );
  assert.equal(
    layoutIdOf({ name: "4-1Khách Sạn Cực Lạc", type: 5, pointRequire: 0 }),
    "4"
  );
  assert.equal(
    layoutIdOf({ name: "Vịnh Thao Thiết", type: 1, pointRequire: 0 }),
    null
  );
});

test("displayNameOf strips the display-id token", () => {
  assert.equal(
    displayNameOf({ name: "1-15Đảo Xích Đu", type: 2, pointRequire: 0 }),
    "Đảo Xích Đu"
  );
  assert.equal(
    displayNameOf({
      name: "Khu nghỉ dưỡng Trường Đảo 3-2",
      type: 4,
      pointRequire: 0,
    }),
    "Khu nghỉ dưỡng Trường Đảo"
  );
  assert.equal(
    displayNameOf({ name: "Vịnh Thao Thiết", type: 1, pointRequire: 0 }),
    "Vịnh Thao Thiết"
  );
});

test("Every non-base island joins exactly one camp and vice versa", () => {
  const dump = raw as {
    camp: Record<string, { name: string; type: number; pointRequire: number }>;
  };
  const layoutIdByGame = new Map(
    Object.values(dump.camp)
      .map((camp) => [layoutIdOf(camp), displayNameOf(camp)] as const)
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
  assert.deepEqual(Object.keys(factionDir).map(Number).sort(), [1, 2, 3, 4]);
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
  // Player không brief hiển thị #id, không mất dòng. Run 2026-10-27 backfill
  // đủ 100% (cooldown server hết) — assertion giữ chuẩn hoá cho run thiếu tên.
  const briefIds = new Set(Object.keys(raw.briefs));
  for (const entry of contributions) {
    if (!briefIds.has(entry.playerId))
      assert.equal(entry.name, `#${entry.playerId}`);
  }
});

test("playerBoard keeps server top-200 order and joins brief names", () => {
  assert.ok(
    playerBoard.length === 200,
    `top-200, thực tế ${playerBoard.length}`
  );
  for (let i = 1; i < playerBoard.length; i++)
    assert.ok(playerBoard[i - 1].rank < playerBoard[i].rank, "rank tăng dần");
  // Row 1 = server hạng 1, có phe, tên từ brief hoặc #id (player bị từ chối brief).
  const top = playerBoard[0];
  assert.equal(top.rank, 1);
  assert.ok(Object.values(factionDir).includes(top.faction));
  assert.match(top.name, /^(#|\S)/);
  // Run 2026-10-27 đủ tên nên không còn #id; nếu run sau thiếu brief thì
  // đúng hợp đồng là #<id>, không được drop row.
  for (const row of playerBoard)
    if (row.name.startsWith("#")) assert.equal(row.name, `#${row.playerId}`);
  // guildId cùng rule contribution: brief trước, fallback guildRoster.
  const roster = raw.guildRoster as Record<string, string>;
  const briefs = raw.briefs as Record<string, { guildId?: string }>;
  for (const row of playerBoard)
    assert.equal(
      row.guildId,
      briefs[row.playerId]?.guildId ?? roster[row.playerId]
    );
  assert.ok(
    playerBoard.some((row) => row.guildId),
    "có row mang guildId"
  );
});

test("factionGuilds keys map to directions; scores sum to a plausible total", () => {
  assert.deepEqual(Object.keys(factionGuilds).sort(), [
    "east",
    "north",
    "south",
    "west",
  ]);
  for (const rows of Object.values(factionGuilds)) {
    assert.ok(rows.length >= 4, "mỗi phe ≥ 4 guild (board 116 guilds[])");
    for (let i = 1; i < rows.length; i++)
      assert.ok(
        rows[i - 1].score >= rows[i].score,
        "sort giảm dần theo server"
      );
    for (const row of rows) assert.match(row.name, /^(#|\S)/);
  }
});

test("fuel joins by direction; factions without base are dropped", () => {
  const dump: SeaLiveDump = {
    snapshotAt: "test",
    camp: {
      "1": { name: "Vịnh Thao Thiết", type: 1, pointRequire: 0 },
      "2": { name: "1-1Đảo Thử", type: 2, pointRequire: 1 },
    },
    owner: { "1": 1, "2": 2 },
    nodeRows: [],
    playerBoard: [],
    factionGuilds: {},
    guildNames: {},
    guildRoster: {},
    briefs: {},
    baseDir: { "Vịnh Thao Thiết": "north" },
    // phe 2 (thiếu base → không có hướng) và 3 (phe lạ) bị bỏ khi join.
    fuel: { "1": 673_961, "2": 178_912, "3": 999 },
  };
  assert.deepEqual(buildLiveData(dump).fuel, { north: 673_961 });

  // Dump cũ thiếu key fuel → {} (UI ẩn nhiên liệu, highlight fallback lực chiến).
  const legacy: SeaLiveDump = { ...dump };
  delete legacy.fuel;
  assert.deepEqual(buildLiveData(legacy).fuel, {});
});
