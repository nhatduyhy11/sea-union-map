// Lịch event Tranh bá Tứ Hải theo đợt. Mỗi đợt kéo dài EVENT_LENGTH_DAYS ngày
// tính từ ngày đầu đợt (thứ Hai → Chủ nhật), chiến trường mở 10:00~22:00 mỗi
// ngày, giờ VN. Day key dạng YYMMDD ("261028") — trùng tên thư mục
// src/data/snapshots/<day>/; đợt định danh bằng day key ngày đầu đợt (trùng
// thư mục src/data/node-bosses/<đợt>/). Thêm đợt mới = thêm ngày đầu đợt vào
// EVENT_ROUNDS.
//
// Rule quy ngày (khớp day key của snapshot): thời điểm từ 22:00 tới trước
// 10:00 hôm sau (ngoài khung chiến trường) tính là của ngày trước; trong khung
// 10:00~22:00 tính là ngày hôm đó. Tương đương: lấy ngày lịch của (t − 10h)
// theo giờ VN.

// Ngày đầu từng đợt, tăng dần.
export const EVENT_ROUNDS = ["261026", "261116"] as const;
export const EVENT_LENGTH_DAYS = 7;

const VN_OFFSET_HOURS = 7;
const BATTLE_OPEN_HOUR = 10;
const BATTLE_CLOSE_HOUR = 22;
const HOUR_MS = 3600_000;
const DAY_MS = 24 * HOUR_MS;

// Date (UTC) → day key YYMMDD theo ngày lịch UTC của nó.
function dayKeyOf(utc: Date): string {
  const yy = String(utc.getUTCFullYear() % 100).padStart(2, "0");
  const mm = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(utc.getUTCDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

export function eventDayOf(at: Date): string {
  return dayKeyOf(
    new Date(at.getTime() + (VN_OFFSET_HOURS - BATTLE_OPEN_HOUR) * HOUR_MS)
  );
}

// Mốc `hour` giờ VN của ngày lịch `day` (YYMMDD).
function vnTimeOf(day: string, hour: number): Date {
  const yy = 2000 + Number(day.slice(0, 2));
  const mm = Number(day.slice(2, 4)) - 1;
  const dd = Number(day.slice(4, 6));
  return new Date(Date.UTC(yy, mm, dd, hour - VN_OFFSET_HOURS));
}

// Cộng `n` ngày lịch vào day key.
export const addDays = (day: string, n: number) =>
  dayKeyOf(new Date(vnTimeOf(day, VN_OFFSET_HOURS).getTime() + n * DAY_MS));

// Các ngày của đợt bắt đầu ở `round`.
export const roundDays = (round: string): string[] =>
  Array.from({ length: EVENT_LENGTH_DAYS }, (_, i) => addDays(round, i));

export const lastDayOf = (round: string) =>
  addDays(round, EVENT_LENGTH_DAYS - 1);

// Đợt chứa ngày `day`; null = ngày ngoài mọi đợt.
export function roundOf(day: string): string | null {
  return (
    EVENT_ROUNDS.find((round) => round <= day && day <= lastDayOf(round)) ??
    null
  );
}

export const isEventDay = (day: string) => roundOf(day) !== null;

// Đợt "hiện tại" theo ngày `day`: đợt đang diễn ra, hoặc đợt gần nhất đã bắt
// đầu (giữa hai đợt / sau đợt cuối). Trước đợt đầu tiên → đợt đầu tiên.
export function currentRoundOf(day: string): string {
  return EVENT_ROUNDS.filter((round) => round <= day).at(-1) ?? EVENT_ROUNDS[0];
}

// Ngày lịch VN (không trừ 10h như eventDayOf).
const vnDayOf = (at: Date) =>
  eventDayOf(new Date(at.getTime() + BATTLE_OPEN_HOUR * HOUR_MS));

export type BattleCountdown =
  | { phase: "open" | "closed"; target: Date }
  | { phase: "ended"; round: string };

// Đồng hồ header: trong khung 10:00~22:00 của một ngày event → đếm tới 22:00;
// ngoài khung → đếm tới 10:00 kế tiếp nếu ngày đó là ngày event (trước khi một
// đợt bắt đầu thì đếm tới 10:00 ngày đầu đợt đó, khi đợt đó cách không quá một
// đợt); không còn ngày event nào gần → "ended" kèm đợt vừa qua.
export function battleCountdown(at: Date): BattleCountdown {
  const day = vnDayOf(at);
  const vnHour = (at.getUTCHours() + VN_OFFSET_HOURS) % 24;

  if (
    isEventDay(day) &&
    vnHour >= BATTLE_OPEN_HOUR &&
    vnHour < BATTLE_CLOSE_HOUR
  )
    return { phase: "open", target: vnTimeOf(day, BATTLE_CLOSE_HOUR) };

  const nextOpenDay = vnHour < BATTLE_OPEN_HOUR ? day : addDays(day, 1);
  if (isEventDay(nextOpenDay))
    return { phase: "closed", target: vnTimeOf(nextOpenDay, BATTLE_OPEN_HOUR) };

  const upcoming = EVENT_ROUNDS.find((round) => round > day);
  const past = EVENT_ROUNDS.filter((round) => round <= day).at(-1);
  if (upcoming && (!past || upcoming <= addDays(day, EVENT_LENGTH_DAYS)))
    return { phase: "closed", target: vnTimeOf(upcoming, BATTLE_OPEN_HOUR) };
  return { phase: "ended", round: past ?? EVENT_ROUNDS[0] };
}

// "261028" → "28" (nhãn nút) / "28/10" (tooltip, toast).
export const dayOfMonth = (day: string) => day.slice(4);
export const dayLabel = (day: string) => `${day.slice(4)}/${day.slice(2, 4)}`;

// "26/10 – 01/11": ngày đầu → ngày cuối đợt, không kèm năm.
export const roundLabel = (round: string) =>
  `${dayLabel(round)} – ${dayLabel(lastDayOf(round))}`;
