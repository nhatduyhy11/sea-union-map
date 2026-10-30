// Lịch event Tranh bá Tứ Hải (SEA_STRUCTURE.md: 10/26 00:00 → 11/2 00:00,
// chiến trường mở 10:00~22:00 mỗi ngày, giờ VN). Day key dạng YYMMDD
// ("261028") — trùng tên thư mục src/data/snapshots/<day>/.
//
// Rule quy ngày (khớp report.py --snapshot): thời điểm từ 22:00 tới trước
// 10:00 hôm sau (ngoài khung chiến trường) tính là của ngày trước; trong khung
// 10:00~22:00 tính là ngày hôm đó. Tương đương: lấy ngày lịch của (t − 10h)
// theo giờ VN.

export const EVENT_DAYS = [
  "261026",
  "261027",
  "261028",
  "261029",
  "261030",
  "261031",
  "261101",
] as const;

const VN_OFFSET_HOURS = 7;
const BATTLE_OPEN_HOUR = 10;

export function eventDayOf(at: Date): string {
  const shifted = new Date(
    at.getTime() + (VN_OFFSET_HOURS - BATTLE_OPEN_HOUR) * 3600_000
  );
  const yy = String(shifted.getUTCFullYear() % 100).padStart(2, "0");
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

const BATTLE_CLOSE_HOUR = 22;
const HOUR_MS = 3600_000;

// Mốc `hour` giờ VN của ngày lịch `day` (YYMMDD).
function vnTimeOf(day: string, hour: number): Date {
  const yy = 2000 + Number(day.slice(0, 2));
  const mm = Number(day.slice(2, 4)) - 1;
  const dd = Number(day.slice(4, 6));
  return new Date(Date.UTC(yy, mm, dd, hour - VN_OFFSET_HOURS));
}

// Ngày lịch VN (không trừ 10h như eventDayOf).
const vnDayOf = (at: Date) =>
  eventDayOf(new Date(at.getTime() + BATTLE_OPEN_HOUR * HOUR_MS));

export type BattleCountdown =
  { phase: "open" | "closed"; target: Date } | { phase: "ended" };

// Đồng hồ header: trong khung 10:00~22:00 của ngày event → đếm tới 22:00;
// ngoài khung → đếm tới 10:00 kế tiếp nếu ngày đó còn là ngày event (trước
// khi event bắt đầu thì đếm tới 10:00 ngày đầu); hết ngày event → "ended".
export function battleCountdown(at: Date): BattleCountdown {
  const days = EVENT_DAYS as readonly string[];
  const day = vnDayOf(at);
  const vnHour = (at.getUTCHours() + VN_OFFSET_HOURS) % 24;

  if (
    days.includes(day) &&
    vnHour >= BATTLE_OPEN_HOUR &&
    vnHour < BATTLE_CLOSE_HOUR
  ) {
    return { phase: "open", target: vnTimeOf(day, BATTLE_CLOSE_HOUR) };
  }

  if (day < days[0]) {
    return { phase: "closed", target: vnTimeOf(days[0], BATTLE_OPEN_HOUR) };
  }
  const nextOpenDay =
    vnHour < BATTLE_OPEN_HOUR
      ? day
      : vnDayOf(new Date(at.getTime() + 24 * HOUR_MS));
  return days.includes(nextOpenDay)
    ? { phase: "closed", target: vnTimeOf(nextOpenDay, BATTLE_OPEN_HOUR) }
    : { phase: "ended" };
}

// "261028" → "28" (nhãn nút) / "28/10" (tooltip, toast).
export const dayOfMonth = (day: string) => day.slice(4);
export const dayLabel = (day: string) => `${day.slice(4)}/${day.slice(2, 4)}`;
