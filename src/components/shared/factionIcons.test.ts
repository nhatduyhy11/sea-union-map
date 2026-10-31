import assert from "node:assert/strict";
import test from "node:test";
import { Flame, Snowflake, Sparkles, ZodiacAries } from "lucide-react";
import { FACTION_ICONS, getFactionIcon } from "./factionIcons";

test("FACTION_ICONS maps each of the 4 faction keys to the correct Lucide icon", () => {
  assert.equal(FACTION_ICONS.east, ZodiacAries);
  assert.equal(FACTION_ICONS.south, Flame);
  assert.equal(FACTION_ICONS.north, Sparkles);
  assert.equal(FACTION_ICONS.west, Snowflake);
});

test("getFactionIcon resolves by id, base-id, or full Vietnamese faction name", () => {
  assert.equal(getFactionIcon("east"), ZodiacAries);
  assert.equal(getFactionIcon("base-east"), ZodiacAries);
  assert.equal(getFactionIcon("Vịnh Thao Thiết"), ZodiacAries);

  assert.equal(getFactionIcon("south"), Flame);
  assert.equal(getFactionIcon("base-south"), Flame);
  assert.equal(getFactionIcon("Long Khư U Ám"), Flame);

  assert.equal(getFactionIcon("north"), Sparkles);
  assert.equal(getFactionIcon("base-north"), Sparkles);
  assert.equal(getFactionIcon("Thần Tự Lấp Lánh"), Sparkles);

  assert.equal(getFactionIcon("west"), Snowflake);
  assert.equal(getFactionIcon("base-west"), Snowflake);
  assert.equal(getFactionIcon("Thánh Đảo Lạnh Giá"), Snowflake);

  assert.equal(getFactionIcon(null), null);
  assert.equal(getFactionIcon(undefined), null);
  assert.equal(getFactionIcon("unknown"), null);
});
