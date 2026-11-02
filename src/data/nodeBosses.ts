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

// Tên boss theo monsterId (bỏ tiền tố "Tứ Hải-" của tên trong game).
const BOSS_NAMES: Record<number, string> = {
  1001: "Oán Linh",
  1002: "Nữ Hoàng Alien",
  1003: "Vô Diện Giả",
  1004: "Pharaoh Cổ Đại",
  1005: "Thỏ Cưa Máy",
  1006: "Bọ Cạp Hoàng Tuyền",
  1007: "Khỉ Điên Đánh Trống",
  1008: "Vô Diện Tử Thần",
  1009: "Hắc Trảo",
  1010: "Hắc Nữ Tăng Ca",
  1011: "Cổ Thần",
  1012: "Kỵ Sĩ Không Đầu",
  1013: "U Ảnh Phu Nhân",
};

// monsterId mới chưa có trong bảng vẫn hiện, kèm id để biết cần bổ sung tên.
export const bossName = (monsterId: number) =>
  BOSS_NAMES[monsterId] ?? `Boss #${monsterId}`;

// Ảnh boss (public/boss/<monsterId>.webp, render từ model spine của boss).
export const bossImageUrl = (monsterId: number) =>
  `${import.meta.env.BASE_URL}boss/${monsterId}.webp`;
