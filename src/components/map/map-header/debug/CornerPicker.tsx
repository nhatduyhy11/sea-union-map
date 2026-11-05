import { useRef, useState } from "react";
import { useDismiss } from "../../../../hooks/useDismiss";
import {
  CORNER_IMAGE_OPTIONS,
  useCornerDebug,
} from "../../../../stores/cornerDebug";
import styles from "./CornerPicker.module.css";

const CORNER_NAMES = ["Trên-trái", "Trên-phải", "Dưới-phải", "Dưới-trái"];
const COORD_RANGE = 2500;

// Nút debug 1..4 cho từng góc canvas (theo chiều kim đồng hồ từ trên-trái):
// popover chọn ảnh + slider tâm x/y, width và opacity, đổi là áp ngay lên canvas.
export function CornerPicker({ index }: { index: number }) {
  const corner = useCornerDebug((state) => state.corners[index]);
  const setCorner = useCornerDebug((state) => state.setCorner);
  const resetCorner = useCornerDebug((state) => state.resetCorner);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useDismiss(open, [rootRef], () => setOpen(false));

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        type="button"
        className={`${styles.cornerButton} ${open ? styles.active : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={`Ảnh góc ${CORNER_NAMES[index]}`}
      >
        {index + 1}
      </button>
      {open && (
        <div className={styles.pop}>
          <div className={styles.head}>
            <span>
              Góc {index + 1} · {CORNER_NAMES[index]}
            </span>
            <button
              type="button"
              className={styles.reset}
              onClick={() => resetCorner(index)}
            >
              Reset
            </button>
          </div>
          <div className={styles.thumbs}>
            <button
              type="button"
              className={`${styles.thumb} ${styles.none} ${corner.file === "" ? styles.selected : ""}`}
              onClick={() => setCorner(index, { file: "" })}
              title="Ẩn"
            >
              ∅
            </button>
            {CORNER_IMAGE_OPTIONS.map((file) => (
              <button
                key={file}
                type="button"
                className={`${styles.thumb} ${corner.file === file ? styles.selected : ""}`}
                onClick={() => setCorner(index, { file })}
                title={file}
              >
                <img
                  src={`${import.meta.env.BASE_URL}${file}`}
                  alt={file}
                  draggable={false}
                />
              </button>
            ))}
          </div>
          <Slider
            label="X"
            value={corner.x}
            min={-COORD_RANGE}
            max={COORD_RANGE}
            step={10}
            onChange={(x) => setCorner(index, { x })}
          />
          <Slider
            label="Y"
            value={corner.y}
            min={-COORD_RANGE}
            max={COORD_RANGE}
            step={10}
            onChange={(y) => setCorner(index, { y })}
          />
          <Slider
            label="Size"
            value={corner.width}
            min={100}
            max={1500}
            step={10}
            onChange={(width) => setCorner(index, { width })}
          />
          <Slider
            label="Opacity"
            value={corner.opacity}
            min={0}
            max={1}
            step={0.01}
            onChange={(opacity) => setCorner(index, { opacity })}
          />
        </div>
      )}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className={styles.slider}>
      <span className={styles.sliderLabel}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      />
      <input
        type="number"
        className={styles.sliderValue}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      />
    </label>
  );
}
