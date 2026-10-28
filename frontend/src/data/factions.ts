import type { Faction } from "../types";

// Nhận diện màu theo hướng: Bắc đỏ cam, Tây vàng, Đông tím, Nam xanh dương nhạt.
// Đồng bộ tự động sang icon căn cứ, viền đảo, edge sở hữu, FactionLegend, BXH.
export const factions: Faction[] = [
  {
    id: "north",
    name: "Phe Bắc",
    short: "Bắc",
    color: "#e54a26",
    direction: "BẮC",
  },
  {
    id: "east",
    name: "Phe Đông",
    short: "Đông",
    color: "#9a63d8",
    direction: "ĐÔNG",
  },
  {
    id: "south",
    name: "Phe Nam",
    short: "Nam",
    color: "#54a5d8",
    direction: "NAM",
  },
  {
    id: "west",
    name: "Phe Tây",
    short: "Tây",
    color: "#d1a41c",
    direction: "TÂY",
  },
];
