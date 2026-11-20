import { useState, type PointerEvent } from "react";
import styles from "./ScoreThreshold.module.css";
import { HEIGHT, PAD, type ScoreDotLayout } from "./scoreDotLayout";
import { ThresholdInput } from "./ThresholdInput";
import { formatThreshold } from "./thresholdValue";
import { NO_THRESHOLD, type ScoreThreshold } from "../../useBaseFilter";

const HATCH_ID = "score-dot-plot-hatch";

// Hàng điều khiển ngưỡng phía trên plot: chiều lọc (>= / <= khi tick "Lấy
// nhỏ hơn"), kẹp cạnh (thêm vạch thứ hai đặt ở đỉnh trục `top`), giá trị
// ngưỡng, nút bỏ lọc.
export function ThresholdBar({
  threshold,
  active,
  top,
  onChange,
}: {
  threshold: ScoreThreshold;
  active: boolean;
  top: number;
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
      <label>
        <input
          type="checkbox"
          checked={threshold.upper !== null}
          onChange={(event) =>
            onChange({
              ...threshold,
              upper: event.target.checked ? top : null,
            })
          }
        />
        Kẹp cạnh
      </label>
      <span className={styles.thresholdValue}>
        Ngưỡng {thresholdSummary(threshold)}
      </span>
      {active && (
        <button type="button" onClick={() => onChange(NO_THRESHOLD)}>
          Bỏ lọc
        </button>
      )}
    </div>
  );
}

function thresholdSummary({ value, below, upper }: ScoreThreshold) {
  if (upper === null) return `${below ? "≤" : "≥"} ${formatThreshold(value)}`;
  const lo = formatThreshold(Math.min(value, upper));
  const hi = formatThreshold(Math.max(value, upper));
  return below ? `≤ ${lo}, ≥ ${hi}` : `${lo} – ${hi}`;
}

// Dấu trên nhãn từng vạch: không kẹp cạnh theo chiều lọc; kẹp cạnh thì vạch
// dưới / vạch trên mang hai dấu ngược nhau (giữ đoạn giữa hoặc hai phía ngoài).
export function lineSigns({ value, below, upper }: ScoreThreshold) {
  const ge = below ? "≤" : "≥";
  const le = below ? "≥" : "≤";
  if (upper === null) return { value: ge, upper: le };
  return value <= upper
    ? { value: ge, upper: le }
    : { value: le, upper: ge };
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

// Vùng bị loại bởi ngưỡng, phủ gạch chéo; vẽ dưới các chấm. Một vạch: dưới
// vạch khi lấy >=, trên vạch khi lấy <=. Kẹp cạnh: hai phía ngoài hai vạch,
// hoặc đoạn giữa khi lấy nhỏ hơn.
export function ThresholdHatch({
  threshold,
  plot,
  right,
}: {
  threshold: ScoreThreshold;
  plot: ScoreDotLayout;
  right: number;
}) {
  const top = PAD.top;
  const bottom = HEIGHT - PAD.bottom;
  const valueY = plot.y(threshold.value);
  let bands: [number, number][];
  if (threshold.upper === null) {
    bands = [threshold.below ? [top, valueY] : [valueY, bottom]];
  } else {
    const upperY = plot.y(threshold.upper);
    const hiY = Math.min(valueY, upperY);
    const loY = Math.max(valueY, upperY);
    bands = threshold.below
      ? [[hiY, loY]]
      : [
          [top, hiY],
          [loY, bottom],
        ];
  }
  return (
    <>
      {bands
        .filter(([from, to]) => to > from)
        .map(([from, to]) => (
          <rect
            key={from}
            className={styles.hatch}
            x={PAD.left}
            width={right - PAD.left}
            y={from}
            height={to - from}
            fill={`url(#${HATCH_ID})`}
          />
        ))}
    </>
  );
}

// Vạch ngưỡng kéo dọc trục (nút tròn ở mép phải, vùng bắt chuột rộng hơn nét
// vẽ), nhãn giá trị ở lề phải đè lên nhãn avg / median khi trùng; vẽ trên các
// chấm. Double-click vạch / nhãn mở ô nhập để gõ ngưỡng chính xác.
export function ThresholdLine({
  value: current,
  sign,
  active,
  plot,
  right,
  onChange,
}: {
  value: number;
  sign: string;
  active: boolean;
  plot: ScoreDotLayout;
  right: number;
  onChange: (value: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const lineY = plot.y(current);
  const drag = (event: PointerEvent<SVGGElement>) => {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const value = plot.value(event.clientY - svg.getBoundingClientRect().top);
    if (value !== current) onChange(value);
  };
  const label = {
    x: right + 3,
    y: lineY - LABEL_HEIGHT / 2,
    width: PAD.right - 3,
    height: LABEL_HEIGHT,
  };
  return (
    <>
      <g
        className={`${styles.threshold} ${active || dragging ? styles.active : ""}`}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }}
        onPointerMove={(event) => dragging && drag(event)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        onDoubleClick={() => setEditing(true)}
      >
        <title>Kéo để đổi ngưỡng, double-click để nhập</title>
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
        {!editing && (
          <foreignObject {...label}>
            <span className={styles.thresholdLabel}>
              {sign} {formatThreshold(current)}
            </span>
          </foreignObject>
        )}
      </g>
      {editing && (
        <foreignObject {...label}>
          <ThresholdInput
            value={current}
            range={plot.range}
            onDone={(value) => {
              setEditing(false);
              if (value !== null) onChange(value);
            }}
          />
        </foreignObject>
      )}
    </>
  );
}

const LABEL_HEIGHT = 18;
