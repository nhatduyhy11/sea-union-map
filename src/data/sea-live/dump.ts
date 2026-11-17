// Snapshot chứa dữ liệu biến động và identity đợt/cụm. Info ghép riêng từ event cache.

// Thông tin tĩnh của node (key = game node id): tên node, loại, ngưỡng chiếm.
export interface CampRow {
  name: string;
  type: number;
  pointRequire: number;
}

// Hình dạng file dump — key số đến đây là string (JSON). Snapshot lịch sử
// (src/data/snapshots/) cùng format.
export interface SeaSnapshot {
  eventStart: string;
  server: string;
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
  baseDir: Record<string, string>;
}

// In-memory join input, assembled exclusively from snapshot + event cache.
export interface SeaLiveDump extends SeaSnapshot {
  guildNames: Record<string, string>;
  guildPower: Record<string, number>;
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
}
