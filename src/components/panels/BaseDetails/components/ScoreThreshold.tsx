import { useState, type PointerEvent } from "react";
import { compact } from "../../../../utils/format";
import styles from "./ScoreThreshold.module.css";
import { HEIGHT, PAD, type ScoreDotLayout } from "./scoreDotLayout";
import type { ScoreThreshold } from "../useBaseFilter";

const HATCH_ID = "score-dot-plot-hatch";

// Hàng điều khiển ngưỡng phía trên plot: chiều lọc (>= / <= khi tick "Lấy
// nhỏ hơn"), giá trị ngưỡng, nút bỏ lọc.
export function ThresholdBar({
  threshold,
  active,
  onChange,
}: {
  threshold: ScoreThreshold;
  active: boolean;
  onChange: (next: ScoreThreshold) => void;
}) {
  return (
    <div className={styles.thresholdBar}>
      <label>
        <input
          type="checkbox"
          checked={threshold.below}
          onChange={(event) =>
            onChange({ ...threshold, below: event.target.checked })
          }
        />
        Lấy nhỏ hơn
      </label>
      <span className={styles.thresholdValue}>
        Ngưỡng {threshold.below ? "≤" : "≥"} {compact(threshold.value)}
      </span>
      {active && (
        <button
          type="button"
          onClick={() => onChange({ value: 0, below: false })}
        >
          Bỏ lọc
        </button>
      )}
    </div>
  );
}

// Pattern gạch chéo cho vùng bị loại; đặt trong <defs> của plot.
export function HatchPattern() {
  return (
    <pattern
      className={styles.hatchPattern}
      id={HATCH_ID}
      width={6}
      height={6}
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)"
    >
      <line x1={0} y1={0} x2={0} y2={6} />
    </pattern>
  );
}

// Vùng bị loại bởi ngưỡng (dưới vạch khi lấy >=, trên vạch khi lấy <=), phủ
// gạch chéo; vẽ dưới các chấm.
export function ThresholdHatch({
  threshold,
  plot,
  right,
}: {
  threshold: ScoreThreshold;
  plot: ScoreDotLayout;
  right: number;
}) {
  const lineY = plot.y(threshold.value);
  const { y, height } = threshold.below
    ? { y: PAD.top, height: lineY - PAD.top }
    : { y: lineY, height: HEIGHT - PAD.bottom - lineY };
  if (height <= 0) return null;
  return (
    <rect
      className={styles.hatch}
      x={PAD.left}
      width={right - PAD.left}
      y={y}
      height={height}
      fill={`url(#${HATCH_ID})`}
    />
  );
}

// Vạch ngưỡng kéo dọc trục (nút tròn ở mép phải, vùng bắt chuột rộng hơn nét
// vẽ); vẽ trên các chấm.
export function ThresholdLine({
  threshold,
  active,
  plot,
  right,
  onChange,
}: {
  threshold: ScoreThreshold;
  active: boolean;
  plot: ScoreDotLayout;
  right: number;
  onChange: (next: ScoreThreshold) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const lineY = plot.y(threshold.value);
  const drag = (event: PointerEvent<SVGGElement>) => {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const value = plot.value(event.clientY - svg.getBoundingClientRect().top);
    if (value !== threshold.value) onChange({ ...threshold, value });
  };
  return (
    <g
      className={`${styles.threshold} ${active || dragging ? styles.active : ""}`}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
      }}
      onPointerMove={(event) => dragging && drag(event)}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
    >
      <line
        className={styles.thresholdHit}
        x1={PAD.left - 30}
        x2={right}
        y1={lineY}
        y2={lineY}
      />
      <line x1={PAD.left} x2={right} y1={lineY} y2={lineY} />
      <rect
        className={styles.thresholdKnob}
        x={right - 16}
        y={lineY - 4}
        width={16}
        height={8}
        rx={4}
      />
    </g>
  );
}
