import test from "node:test";
import assert from "node:assert/strict";
import { rankFactionsForHighlight } from "./factionHighlight";
import type { FactionBoardEntry } from "../../../types";

// Entry tối giản cho test highlight — các trường khác không tham gia xếp hạng.
const entry = (
  id: string,
  fuel?: number,
  score = 0
): FactionBoardEntry => ({
  id,
  name: id.toUpperCase(),
  color: "#000000",
  labelColor: "#ffffff",
  score,
  power: 0,
  islands: 0,
  guilds: [],
  fuel,
});

test("Ranks by fuel when any faction has fuel", () => {
  // Fuel là truth server — phe fuel cao nhất rank 1 dù điểm phe ngược lại.
  const ranks = rankFactionsForHighlight([
    entry("a", 100, 9_000_000),
    entry("b", 500, 1_000_000),
    entry("c", 0, 5_000_000),
  ]);
  assert.equal(ranks.get("b"), 1);
  assert.equal(ranks.get("a"), 2);
  // fuel = 0 coi như không có nhiên liệu → không vào bảng xếp hạng.
  assert.equal(ranks.has("c"), false);
});

test("Falls back to score when no faction has fuel (old dumps)", () => {
  const ranks = rankFactionsForHighlight([
    entry("a", undefined, 2_000_000),
    entry("b", undefined, 8_000_000),
    entry("c"),
  ]);
  assert.equal(ranks.get("b"), 1);
  assert.equal(ranks.get("a"), 2);
  assert.equal(ranks.has("c"), false);
});

test("Fuel presence on one faction switches the whole board to fuel mode", () => {
  // Phe còn lại thiếu fuel (undefined) bị loại — không fallback score lẫn cột.
  const ranks = rankFactionsForHighlight([
    entry("a", 300, 9_000_000),
    entry("b", undefined, 8_000_000),
  ]);
  assert.equal(ranks.get("a"), 1);
  assert.equal(ranks.has("b"), false);
});

test("No fuel and no score → empty map, nothing highlighted", () => {
  const ranks = rankFactionsForHighlight([entry("a", undefined), entry("b")]);
  assert.deepEqual([...ranks], []);
});
