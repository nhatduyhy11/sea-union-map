import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSelection } from "../../../../../stores/selection";
import { compact } from "../../../../../utils/format";
import styles from "./ScoreDotPlot.module.css";
import { HEIGHT, PAD, R, layoutScoreDots } from "./scoreDotLayout";
import {
  HatchPattern,
  ThresholdBar,
  ThresholdHatch,
  ThresholdLine,
  lineSigns,
} from "./ScoreThreshold";
import type { ScoreThreshold } from "../../useBaseFilter";
import type {
  IslandBucketStats,
  IslandPoints,
} from "../../../../../domain/selectors/board/types";

// Dot plot dọc phân bố điểm phe trên các đảo đủ điểm: mỗi chấm một đảo (đặc =
// đang chiếm, rỗng = mất: đủ điểm chưa chiếm), trục log lớn ở trên, vạch avg /
// median của cả tập. Đảo 0 điểm (chiếm mà phe không có điểm) nằm ở dải "0"
// dưới đáy. highlight (filter đang bật) làm nổi chấm thuộc tập, mờ phần còn
// lại. Hover chấm hiện id đảo (như nhãn trên map) kèm điểm và bật viền hover
// của node đó trên canvas; click chấm gọi onSelect (focus đảo đó). Vạch ngưỡng
// kéo dọc trục lọc đảo theo điểm (kẹp cạnh thêm vạch thứ hai); vùng bị loại
// phủ gạch chéo.
export function ScoreDotPlot({
  islands,
  stats,
  color,
  highlight,
  threshold,
  thresholdActive,
  onThreshold,
  onSelect,
}: {
  islands: IslandPoints[];
  stats: IslandBucketStats;
  color: string;
  highlight?: ReadonlySet<string> | null;
  threshold: ScoreThreshold;
  thresholdActive: boolean;
  onThreshold: (next: ScoreThreshold) => void;
  onSelect?: (id: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(280);
  const hover = useSelection((state) => state.hover);
  // Graph unmount (đổi phe/đóng panel) khi chuột còn trên chấm → không có
  // mouseleave, xoá hover để node trên canvas không kẹt viền.
  useEffect(() => () => hover(null), [hover]);
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
    () => layoutScoreDots(islands, stats, width),
    [islands, stats, width]
  );
  const right = width - PAD.right;
  const signs = lineSigns(threshold);

  return (
    <div ref={box} className={styles.plot}>
      <ThresholdBar
        threshold={threshold}
        active={thresholdActive}
        top={plot.range.max}
        onChange={onThreshold}
      />
      <svg width={width} height={HEIGHT} role="img">
        <defs>
          <HatchPattern />
        </defs>
        {plot.ticks.map((tick) => (
          <g key={tick.label} className={styles.tick}>
            <line x1={PAD.left} x2={right} y1={tick.y} y2={tick.y} />
            <text x={PAD.left - 6} y={tick.y}>
              {tick.label}
            </text>
          </g>
        ))}
        {thresholdActive && (
          <ThresholdHatch threshold={threshold} plot={plot} right={right} />
        )}
        {plot.refs.map((ref) => (
          <g key={ref.name} className={styles.ref}>
            <line x1={PAD.left} x2={right + 4} y1={ref.y} y2={ref.y} />
            <text x={right + 8} y={ref.labelY}>
              {ref.name} <tspan>{compact(ref.value)}</tspan>
            </text>
          </g>
        ))}
        {plot.dots.map((dot) => {
          const hot = highlight?.has(dot.id);
          return (
            <circle
              key={dot.id}
              className={`${styles.dot} ${highlight && !hot ? styles.faded : ""}`}
              cx={dot.x}
              cy={dot.y}
              r={hot ? R + 1.5 : R}
              fill={dot.owned ? color : "#ffffff"}
              stroke={color}
              onClick={() => onSelect?.(dot.id)}
              onMouseEnter={() => hover(dot.id)}
              onMouseLeave={() => hover(null)}
            >
              <title>{`${dot.id} | ${compact(dot.points)}`}</title>
            </circle>
          );
        })}
        <ThresholdLine
          value={threshold.value}
          sign={signs.value}
          active={thresholdActive}
          plot={plot}
          right={right}
          onChange={(value) => onThreshold({ ...threshold, value })}
        />
        {threshold.upper !== null && (
          <ThresholdLine
            value={threshold.upper}
            sign={signs.upper}
            active={thresholdActive}
            plot={plot}
            right={right}
            onChange={(upper) => onThreshold({ ...threshold, upper })}
          />
        )}
      </svg>
      <div className={styles.legend}>
        <span>
          <i style={{ background: color, borderColor: color }} />
          Đang chiếm
        </span>
        <span>
          <i style={{ borderColor: color }} />
          Mất
        </span>
        <span className={styles.legendRef}>— avg / median của cả tập</span>
      </div>
    </div>
  );
}
