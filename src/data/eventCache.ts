// Sea identity is stored once per event × server. No embedded-info reader.
import type { SeaLiveDump, SeaSnapshot } from "./sea-live/dump";

export interface EventInfo {
  schemaVersion: number;
  eventStart: string;
  server: string;
  sourceAt: string;
  guildRoster: Record<string, string>;
  guildNames: Record<string, string>;
  guildPower: Record<string, number>;
  briefs: SeaLiveDump["briefs"];
}

export async function loadEventSnapshot(
  snapshot: SeaSnapshot
): Promise<SeaLiveDump> {
  const { default: info } = (await import(
    `./event-cache/${snapshot.eventStart}/${snapshot.server}/info.json`
  )) as { default: EventInfo };
  if (
    info.schemaVersion !== 1 ||
    info.server !== snapshot.server ||
    info.eventStart !== snapshot.eventStart
  )
    throw new Error(
      `Invalid Sea cache ${snapshot.eventStart}/${snapshot.server}`
    );
  return {
    ...snapshot,
    guildRoster: info.guildRoster,
    guildNames: info.guildNames,
    guildPower: info.guildPower,
    briefs: info.briefs,
  };
}
