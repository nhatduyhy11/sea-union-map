import { snapThreshold } from "./thresholdValue";
import type {
  IslandBucketStats,
  IslandPoints,
} from "../../../../../domain/selectors/board/types";

export const HEIGHT = 240;
export const PAD = { top: 8, right: 74, bottom: 8, left: 34 };
export const R = 3.5;
const ZERO_BAND = 20;

export type ScoreDotLayout = ReturnType<typeof layoutScoreDots>;

// Toạ độ dot plot dọc: trục log lớn ở trên, dải "0" dưới đáy (log không biểu
// diễn được 0; dải luôn có vì cũng là chỗ của vạch ngưỡng mức 0). y() đổi điểm
// → toạ độ, value() là nghịch đảo dùng khi kéo vạch ngưỡng.
export function layoutScoreDots(
  islands: IslandPoints[],
  stats: IslandBucketStats,
  width: number
) {
  const positive = islands.filter((island) => island.points > 0);
  const bottom = HEIGHT - PAD.bottom - ZERO_BAND;
  const zeroY = HEIGHT - PAD.bottom - ZERO_BAND / 2;

  const min = positive.length ? positive[0].points : 1;
  const max = positive.length ? positive[positive.length - 1].points : 10;
  const lo = Math.floor(Math.log10(min));
  const hi = Math.max(Math.ceil(Math.log10(max)), lo + 1);
  // Giá trị ngoài trục (ngưỡng gõ tay) kẹp ở mép trên.
  const y = (value: number) =>
    value <= 0
      ? zeroY
      : Math.max(
          PAD.top,
          bottom - ((Math.log10(value) - lo) / (hi - lo)) * (bottom - PAD.top)
        );
  // Toạ độ dọc → giá trị ngưỡng, kẹp trong trục, snap về số gọn; kéo xuống quá nửa khe giữa trục log và dải 0 = 0.
  const value = (py: number) => {
    if (py >= (bottom + zeroY) / 2) return 0;
    const clamped = Math.max(PAD.top, Math.min(bottom, py));
    const t = (bottom - clamped) / (bottom - PAD.top);
    return snapThreshold(10 ** (lo + t * (hi - lo)));
  };

  const steps = hi - lo > 3 ? [1] : [1, 2, 5];
  const ticks: { y: number; label: string }[] = [];
  for (let decade = lo; decade <= hi; decade++) {
    for (const step of steps) {
      const tick = step * 10 ** decade;
      if (tick > 10 ** hi) break;
      ticks.push({ y: y(tick), label: tickLabel(tick) });
    }
  }
  ticks.push({ y: zeroY, label: "0" });

  // Beeswarm: chấm né nhau theo chiều ngang, lần lượt thử lệch 0, +s, -s,
  // +2s… quanh trục giữa cho tới chỗ không chạm chấm đã đặt.
  const center = PAD.left + (width - PAD.left - PAD.right) / 2;
  const gap = (2 * R + 1) ** 2;
  const dots: (IslandPoints & { x: number; y: number })[] = [];
  for (const island of islands) {
    const cy = y(island.points);
    for (let i = 0; ; i++) {
      const offset = Math.ceil(i / 2) * (i % 2 ? 1 : -1) * R;
      const cx = center + offset;
      const hit = dots.some(
        (dot) => (dot.x - cx) ** 2 + (dot.y - cy) ** 2 < gap
      );
      if (!hit || Math.abs(offset) > center - PAD.left) {
        dots.push({ ...island, x: cx, y: cy });
        break;
      }
    }
  }

  // Nhãn avg / median ở lề phải; hai vạch quá sát thì đẩy nhãn ra xa nhau.
  const refs = [
    { name: "avg", value: stats.mean, y: y(stats.mean) },
    { name: "median", value: stats.median, y: y(stats.median) },
  ].map((ref) => ({ ...ref, labelY: ref.y }));
  const [upper, lower] = refs[0].y <= refs[1].y ? refs : [refs[1], refs[0]];
  const overlap = 11 - (lower.y - upper.y);
  if (overlap > 0) {
    upper.labelY -= overlap / 2;
    lower.labelY += overlap / 2;
  }
  // Khoảng hợp lệ của ngưỡng gõ tay: mốc thấp nhất → mốc cao nhất trục log.
  const range = { min: 10 ** lo, max: 10 ** hi };
  return { ticks, dots, refs, y, value, range };
}

function tickLabel(value: number) {
  if (value >= 1e9) return `${value / 1e9}B`;
  if (value >= 1e6) return `${value / 1e6}M`;
  if (value >= 1e3) return `${value / 1e3}k`;
  return `${value}`;
}
