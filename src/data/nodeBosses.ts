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

// Ảnh boss (public/boss/<monsterId>.webp, render từ model spine của boss).
export const bossImageUrl = (monsterId: number) =>
  `${import.meta.env.BASE_URL}boss/${monsterId}.webp`;
