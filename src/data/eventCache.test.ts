import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { loadEventSnapshot } from "./eventCache";
import { buildLiveData } from "./sea-live/join";
import type { SeaSnapshot } from "./sea-live/dump";

test("all migrated snapshots join their own event cache without losing server rows", async () => {
  const root = new URL("./snapshots/", import.meta.url);
  for (const day of (await readdir(root)).filter((day) => /^\d{6}$/.test(day))) {
    for (const file of (await readdir(new URL(`${day}/`, root))).filter((file) =>
      /^\d+\.json$/.test(file)
    )) {
      const snapshot: SeaSnapshot = JSON.parse(
        await readFile(new URL(`${day}/${file}`, root), "utf8")
      );
      const dump = await loadEventSnapshot(snapshot);
      const live = buildLiveData(dump);
      assert.equal(snapshot.server, file.replace(".json", ""));
      assert.equal(
        live.contributions.length,
        snapshot.nodeRows.filter((row) => live.factionDir[row[3]]).length
      );
      assert.equal(
        live.playerBoard.length,
        snapshot.playerBoard.filter(
          (row) => row[3] !== null && live.factionDir[row[3]]
        ).length
      );
      for (const row of live.contributions) {
        if (!dump.briefs[row.playerId])
          assert.equal(row.name, `#${row.playerId}`);
        if (dump.guildRoster[row.playerId])
          assert.equal(row.guildId, dump.guildRoster[row.playerId]);
      }
    }
  }
});

test("missing event cache rejects even if a dump carries legacy embedded info", async () => {
  const snapshot = JSON.parse(
    await readFile(new URL("./sea-live.json", import.meta.url), "utf8")
  );
  await assert.rejects(
    loadEventSnapshot({
      ...snapshot,
      eventStart: "999999",
      briefs: {},
      guildRoster: {},
      guildNames: {},
      guildPower: {},
    })
  );
});
