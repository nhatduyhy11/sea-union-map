import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { compact } from "../../../utils/format";
import styles from "./BaseDetails.module.css";
import type { IslandBucketStats, IslandPoints } from "../../../types";

const HEIGHT = 240;
const PAD = { top: 8, right: 74, bottom: 8, left: 34 };
const ZERO_BAND = 20;
const R = 3.5;

// Dot plot dọc phân bố điểm phe trên các đảo đủ điểm: mỗi chấm một đảo (đặc =
// đang chiếm, rỗng = đủ điểm chưa chiếm), trục log lớn ở trên, vạch avg /
// median của cả tập. Đảo 0 điểm (chiếm mà phe không có điểm) nằm ở dải "0"
// dưới đáy vì log không biểu diễn được 0.
export function ScoreDotPlot({
  islands,
  stats,
  color,
}: {
  islands: IslandPoints[];
  stats: IslandBucketStats;
  color: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(280);
  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry.contentRect.width))
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const plot = useMemo(
    () => layout(islands, stats, width),
    [islands, stats, width]
  );

  return (
    <div ref={box} className={styles.plot}>
      <svg width={width} height={HEIGHT} role="img">
        {plot.ticks.map((tick) => (
          <g key={tick.label} className={styles.tick}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={tick.y}
              y2={tick.y}
            />
            <text x={PAD.left - 6} y={tick.y}>
              {tick.label}
            </text>
          </g>
        ))}
        {plot.refs.map((ref) => (
          <g key={ref.name} className={styles.ref}>
            <line
              x1={PAD.left}
              x2={width - PAD.right + 4}
              y1={ref.y}
              y2={ref.y}
            />
            <text x={width - PAD.right + 8} y={ref.labelY}>
              {ref.name} <tspan>{compact(ref.value)}</tspan>
            </text>
          </g>
        ))}
        {plot.dots.map((dot) => (
          <circle
            key={dot.id}
            className={styles.dot}
            cx={dot.x}
            cy={dot.y}
            r={R}
            fill={dot.owned ? color : "#ffffff"}
            stroke={color}
          >
            <title>
              {`${dot.name} · ${compact(dot.points)} · ${
                dot.owned ? "đang chiếm" : "đủ điểm, chưa chiếm"
              }`}
            </title>
          </circle>
        ))}
      </svg>
      <div className={styles.legend}>
        <span>
          <i style={{ background: color, borderColor: color }} />
          Đang chiếm
        </span>
        <span>
          <i style={{ borderColor: color }} />
          Đủ điểm, chưa chiếm
        </span>
        <span className={styles.legendRef}>— avg / median của cả tập</span>
      </div>
    </div>
  );
}

function layout(
  islands: IslandPoints[],
  stats: IslandBucketStats,
  width: number
) {
  const positive = islands.filter((island) => island.points > 0);
  const hasZero = positive.length < islands.length;
  const bottom = HEIGHT - PAD.bottom - (hasZero ? ZERO_BAND : 0);
  const zeroY = HEIGHT - PAD.bottom - ZERO_BAND / 2;

  const min = positive.length ? positive[0].points : 1;
  const max = positive.length ? positive[positive.length - 1].points : 10;
  const lo = Math.floor(Math.log10(min));
  const hi = Math.max(Math.ceil(Math.log10(max)), lo + 1);
  const y = (value: number) =>
    value <= 0
      ? zeroY
      : bottom - ((Math.log10(value) - lo) / (hi - lo)) * (bottom - PAD.top);

  const steps = hi - lo > 3 ? [1] : [1, 2, 5];
  const ticks: { y: number; label: string }[] = [];
  for (let decade = lo; decade <= hi; decade++) {
    for (const step of steps) {
      const value = step * 10 ** decade;
      if (value > 10 ** hi) break;
      ticks.push({ y: y(value), label: tickLabel(value) });
    }
  }
  if (hasZero) ticks.push({ y: zeroY, label: "0" });

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
  return { ticks, dots, refs };
}

function tickLabel(value: number) {
  if (value >= 1e9) return `${value / 1e9}B`;
  if (value >= 1e6) return `${value / 1e6}M`;
  if (value >= 1e3) return `${value / 1e3}k`;
  return `${value}`;
}
