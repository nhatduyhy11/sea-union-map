import type { Contribution, Faction, Island } from "../types";

export const factions: Faction[] = [
  { id: "a", name: "A", color: "#123456", labelColor: "#0000ff" },
  { id: "b", name: "B", color: "#abcdef", labelColor: "#ff0000" },
];
export const islands: Island[] = [
  {
    id: "1-1",
    name: "Đảo Gió",
    position: { x: 0, y: 0 },
    owner: "a",
    claimThreshold: 1,
  },
  {
    id: "2-1",
    name: "Đảo Biển",
    position: { x: 50, y: 50 },
    owner: "b",
    claimThreshold: 1,
  },
];
export const contributions: Contribution[] = [
  { nodeId: "1-1", playerId: "p1", name: "One", faction: "a", score: 100 },
  { nodeId: "2-1", playerId: "p1", name: "One", faction: "a", score: 300 },
  { nodeId: "1-1", playerId: "p2", name: "Two", faction: "b", score: 200 },
  {
    nodeId: "2-1",
    playerId: "p3",
    name: "Three",
    faction: "a",
    guild: "G",
    score: 50,
  },
];

// Node-board row builder: mặc định node "1-1", phe "a", name = playerId viết hoa.
export const row = (
  o: Partial<Contribution> & Pick<Contribution, "playerId" | "score">
): Contribution => ({
  nodeId: "1-1",
  name: o.playerId.toUpperCase(),
  faction: "a",
  ...o,
});
