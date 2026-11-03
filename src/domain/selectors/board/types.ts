import type {
  Contribution,
  Faction,
  FactionScore,
  Island,
  Player,
} from "../../../types";
import type { Attacker } from "../nodeScores";

export interface LeaderboardPlayer extends Player {
  factionInfo?: Faction;
  // Hạng trên board server (board 117) — badge đầu row, không đổi theo sort.
  rank: number;
  score: number;
  nodes: number;
  allocations: Contribution[];
}

export interface GuildScore {
  // Guild identity: guildId từ game (unique sẵn — hai guild cùng tên vẫn tách
  // biệt); bucket gộp player không guild dùng nguyên chuỗi "Không guild".
  id: string;
  // Display name: tên guild (hoặc "Không guild")
  name: string;
  // Alias của id — giữ tương thích với code cũ / tests
  guild: string;
  score: number;
  players: number;
  // Số đảo guild có đóng góp — metadata của guild row ở BXH Phe.
  nodes: number;
  // Thành viên sort theo điểm — dữ liệu cho drill-down guild → thành viên.
  members: GuildMember[];
  power?: number;
  server?: number;
  guildId?: string;
}

export interface GuildMember {
  id: string;
  name: string;
  score: number;
  nodes: number;
  power?: number;
  server?: number;
}

export type SortBy = "power" | "score";

// "BXH Phe" entry: the faction's score is the sum of its member guilds'
// totals (dump factionGuilds, "Tổng quan phe"), islands = owned nodes
// excluding the base ("Chiếm đảo"), `touched` = all nodes with positive faction points, including owned nodes.
export interface FactionBoardEntry extends Faction {
  score: number;
  // Tổng lực chiến các guild trong phe (0 = chưa có power data).
  power: number;
  islands: number;
  // Số đảo phe có điểm > 0 (touched), gồm cả đảo đang chiếm.
  touched: number;
  // Số đảo có điểm > 0 và đủ ngưỡng claim, không xét connection.
  claimable: number;
  // Tổng Nhiên Liệu phe, undefined = dump thiếu fuel (data cũ)
  // — UI ẩn "(nhiên liệu)", highlight fallback Điểm phe (factionHighlight).
  fuel?: number;
  guilds: GuildScore[];
}

// "Cứ điểm" board entry: one node ranked by the points all factions poured
// into it, with the per-faction breakdown ready for the expanded row.
export interface NodeBoardEntry {
  island: Island;
  // Phe đang chiếm (undefined = chưa ai chiếm) — tô màu row.
  owner?: Faction;
  total: number;
  scores: FactionScore[];
  attackers: Attacker[];
}

// Một tập đảo trong thống kê căn cứ phe: số đảo + tổng / trung bình / trung vị
// điểm phe trên các đảo đó (0 khi tập rỗng); ids = các đảo của tập (highlight
// trên map khi bật dòng đó làm filter).
export interface IslandBucketStats {
  count: number;
  total: number;
  mean: number;
  median: number;
  ids: ReadonlySet<string>;
}

// Điểm phe trên một đảo thuộc tập enough; owned = phe đang chiếm đảo đó.
export interface IslandPoints {
  id: string;
  name: string;
  points: number;
  owned: boolean;
}

// Tập đảo theo điểm phe: owned / claimable / below rời nhau; enough = owned +
// claimable, touched = cả ba.
export type IslandBucket =
  "owned" | "claimable" | "below" | "enough" | "touched";

// Thống kê chi tiết căn cứ phe (BaseDetails): năm tập theo điểm phe, cộng hai
// tập theo icon canvas — frontline (đảo giao tranh mà phe là owner hoặc phe
// nhì ở cửa) và overbuilt (đảo phe chiếm có icon overbuilt). enoughIslands là
// từng đảo của enough, tăng dần theo điểm.
export interface FactionIslandStats extends Record<
  IslandBucket,
  IslandBucketStats
> {
  frontline: ReadonlySet<string>;
  overbuilt: ReadonlySet<string>;
  enoughIslands: IslandPoints[];
}

// Filter đảo của chi tiết căn cứ: một dòng của bảng điểm phe (IslandBucket)
// hoặc một tập theo icon canvas.
export type FactionNodeFilter = IslandBucket | "frontline" | "overbuilt";
