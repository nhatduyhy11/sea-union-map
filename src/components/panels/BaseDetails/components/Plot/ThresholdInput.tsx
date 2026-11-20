import styles from "./ThresholdInput.module.css";
import { useThresholdInput } from "./useThresholdInput";

// Ô nhập ngưỡng điểm, mở đè lên nhãn vạch ngưỡng; tự focus và chọn sẵn chữ.
export function ThresholdInput(props: {
  value: number;
  range: { min: number; max: number };
  onDone: (value: number | null) => void;
}) {
  const { text, invalid, change, commit, keyDown } = useThresholdInput(props);
  return (
    <input
      className={`${styles.input} ${invalid ? styles.invalid : ""}`}
      autoFocus
      value={text}
      placeholder="34 = 34M"
      title="Đơn vị k / m (tr) / b (tỷ); số trần < 1000 hiểu là M"
      aria-invalid={invalid}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => change(event.target.value)}
      onBlur={commit}
      onKeyDown={keyDown}
    />
  );
}
