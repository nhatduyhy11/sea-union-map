// Boss từng node theo đợt event × cụm server:
// src/data/node-bosses/<ngày đầu đợt>/<server>.json — gameNodeId → monsterId
// (boss hiện ở kính lúp chi tiết cứ điểm), ghi bằng `report.py --snapshot` /
// `--node-bosses`. Boss cố định suốt đợt trong một cụm nên không nằm trong
// snapshot từng ngày; cụm thiếu file → node không có boss.

import { EVENT_DAYS } from "./eventCalendar";

const modules = import.meta.glob<Record<string, number>>(
  "./node-bosses/*/*.json",
  { eager: true, import: "default" }
);

export function nodeBossesOf(server: string): Record<string, number> {
  return modules[`./node-bosses/${EVENT_DAYS[0]}/${server}.json`] ?? {};
}

// Boss theo monsterId: tên (bỏ tiền tố "Tứ Hải-" của tên trong game) và model
// spine. Ảnh boss nằm ở public/boss/<monsterId>-<model>/ gồm render.webp (render
// frame idle từ model spine), half.webp (ảnh bán thân) và head.webp (avatar).
const BOSSES: Record<number, { name: string; model: string }> = {
  1001: { name: "Oán Linh", model: "Boss_009" },
  1002: { name: "Nữ Hoàng Alien", model: "Boss_008" },
  1003: { name: "Vô Diện Giả", model: "Boss_010" },
  1004: { name: "Pharaoh Cổ Đại", model: "Boss_014" },
  1005: { name: "Thỏ Cưa Máy", model: "Boss_019_sea" },
  1006: { name: "Bọ Cạp Hoàng Tuyền", model: "Boss_034" },
  1007: { name: "Khỉ Điên Đánh Trống", model: "Boss_029" },
  1008: { name: "Vô Diện Tử Thần", model: "Boss_026" },
  1009: { name: "Hắc Trảo", model: "Boss_025" },
  1010: { name: "Hắc Nữ Tăng Ca", model: "Boss_024" },
  1011: { name: "Cổ Thần", model: "Boss_021" },
  1012: { name: "Kỵ Sĩ Không Đầu", model: "Boss_017" },
  1013: { name: "U Ảnh Phu Nhân", model: "Boss_015" },
};

// Mọi boss đã biết, theo monsterId tăng dần.
export const KNOWN_BOSS_IDS: readonly number[] = Object.keys(BOSSES)
  .map(Number)
  .sort((a, b) => a - b);

// monsterId mới chưa có trong bảng vẫn hiện, kèm id để biết cần bổ sung tên.
export const bossName = (monsterId: number) =>
  BOSSES[monsterId]?.name ?? `Boss #${monsterId}`;

export type BossImageKind = "render" | "half" | "head";

// monsterId chưa có trong bảng → không có ảnh.
export function bossImageUrl(
  monsterId: number,
  kind: BossImageKind = "render"
): string | undefined {
  const boss = BOSSES[monsterId];
  if (!boss) return undefined;
  return `${import.meta.env.BASE_URL}boss/${monsterId}-${boss.model}/${kind}.webp`;
}
