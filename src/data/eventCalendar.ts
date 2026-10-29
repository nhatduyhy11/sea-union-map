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

// "261028" → "28" (nhãn nút) / "28/10" (tooltip, toast).
export const dayOfMonth = (day: string) => day.slice(4);
export const dayLabel = (day: string) => `${day.slice(4)}/${day.slice(2, 4)}`;
