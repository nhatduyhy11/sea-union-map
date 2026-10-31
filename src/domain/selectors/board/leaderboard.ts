import type {
  Contribution,
  Faction,
  LeaderboardPlayer,
  ServerPlayerRow,
} from "../../../types";
import { playerAllocations } from "../nodeScores";

// Tab Cá nhân live: rows = BXH điểm server (top-200, board 117). Thứ tự và
// điểm giữ nguyên server — chỉ ghép thêm allocations từ node boards cho phần
// expand ("contribute vào đâu"). Player ngoài top-N node nào thì expand rỗng.
export function buildServerLeaderboard(
  rows: ServerPlayerRow[],
  contributions: Contribution[],
  factions: Faction[]
): LeaderboardPlayer[] {
  return rows.map((row) => {
    const allocations = playerAllocations(row.playerId, contributions);
    return {
      id: row.playerId,
      name: row.name,
      faction: row.faction ?? "",
      // Hạng server giữ nguyên dù list được sort lại theo LC.
      rank: row.rank,
      guild: row.guild,
      factionInfo: row.faction
        ? factions.find((faction) => faction.id === row.faction)
        : undefined,
      score: row.score,
      nodes: allocations.length,
      allocations,
      // Lực chiến player từ brief (join playerBoard) — UI hiện cạnh số đảo.
      power: row.power,
    };
  });
}
