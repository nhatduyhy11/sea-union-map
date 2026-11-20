import { useState, type PointerEvent } from "react";
import styles from "./ScoreThreshold.module.css";
import { HEIGHT, PAD, type ScoreDotLayout } from "./scoreDotLayout";
import {
  clampThreshold,
  formatThreshold,
  parseThreshold,
} from "./thresholdValue";
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
        Ngưỡng {threshold.below ? "≤" : "≥"} {formatThreshold(threshold.value)}
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
// vẽ), nhãn giá trị ở lề phải đè lên nhãn avg / median khi trùng; vẽ trên các
// chấm. Double-click vạch / nhãn mở ô nhập để gõ ngưỡng chính xác.
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
  const [editing, setEditing] = useState(false);
  const lineY = plot.y(threshold.value);
  const drag = (event: PointerEvent<SVGGElement>) => {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const value = plot.value(event.clientY - svg.getBoundingClientRect().top);
    if (value !== threshold.value) onChange({ ...threshold, value });
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
              {threshold.below ? "≤" : "≥"} {formatThreshold(threshold.value)}
            </span>
          </foreignObject>
        )}
      </g>
      {editing && (
        <foreignObject {...label}>
          <ThresholdInput
            value={threshold.value}
            onDone={(value) => {
              setEditing(false);
              if (value !== null)
                onChange({
                  ...threshold,
                  value: clampThreshold(value, plot.range),
                });
            }}
          />
        </foreignObject>
      )}
    </>
  );
}

const LABEL_HEIGHT = 18;

// Ô nhập ngưỡng (cú pháp ở parseThreshold). Enter: hợp lệ thì áp, không thì
// viền đỏ và giữ ô để sửa. Rời ô: hợp lệ thì áp, không thì huỷ. Esc: huỷ
// (chặn lan ra phím Esc bỏ chọn đảo).
function ThresholdInput({
  value,
  onDone,
}: {
  value: number;
  onDone: (value: number | null) => void;
}) {
  const [text, setText] = useState(formatThreshold(value));
  const [invalid, setInvalid] = useState(false);
  return (
    <input
      className={`${styles.thresholdInput} ${invalid ? styles.invalid : ""}`}
      autoFocus
      value={text}
      placeholder="34 = 34M"
      title="Đơn vị k / m (tr) / b (tỷ); số trần < 1000 hiểu là M"
      aria-invalid={invalid}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => {
        setText(event.target.value);
        setInvalid(false);
      }}
      onBlur={() => onDone(parseThreshold(text))}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          if (parseThreshold(text) === null) setInvalid(true);
          else event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          event.stopPropagation();
          onDone(null);
        }
      }}
    />
  );
}
