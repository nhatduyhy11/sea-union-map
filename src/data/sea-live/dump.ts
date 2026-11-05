// Format file dump (sea-live.json, dev dump, snapshot lịch sử) — hợp đồng dữ
// liệu FE nhận vào.

// Thông tin tĩnh của node (key = game node id): tên node, loại, ngưỡng chiếm.
export interface CampRow {
  name: string;
  type: number;
  pointRequire: number;
}

// Hình dạng file dump — key số đến đây là string (JSON). Snapshot lịch sử
// (src/data/snapshots/) cùng format.
export interface SeaLiveDump {
  snapshotAt: string;
  camp: Record<string, CampRow>;
  owner: Record<string, number>;
  nodeRows: [number, number, number, number][];
  // Tổng điểm từng phe tại node do server tính:
  // gameNodeId → campId → điểm. Optional: dump cũ không có key này.
  nodeFactionScores?: Record<string, Record<string, number>>;
  // Tổng Nhiên Liệu từng phe: campId → nhiên liệu. Optional: dump cũ không có key này.
  fuel?: Record<string, number>;
  playerBoard: [number, number, number, number | null][];
  factionGuilds: Record<string, [number, number][]>;
  guildNames: Record<string, string>;
  // Optional: dump cũ không có key này.
  guildPower?: Record<string, number>;
  guildRoster: Record<string, string>;
  briefs: Record<
    string,
    {
      name: string;
      guildId?: string;
      guild?: string;
      power?: number;
      server?: number;
    }
  >;
  baseDir: Record<string, string>;
}
