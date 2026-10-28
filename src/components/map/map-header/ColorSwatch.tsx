import { useEffect, useRef, useState, type ComponentType } from "react";
import styles from "./ColorSwatch.module.css";

// HexAlphaColorPicker của react-colorful — chỉ dùng ở dev, load động.
type HexAlphaPicker = ComponentType<{
  color: string;
  onChange: (color: string) => void;
}>;

export interface ColorSwatchProps {
  label: string;
  value: string;
  onChange: (hex8: string) => void;
}

// Chip debug chọn màu: swatch mở popover react-colorful (màu + alpha trong
// một control); click ra ngoài tự đóng. value/onChange làm việc trên hex
// 6 hoặc 8 ký tự — picker trả #rrggbbaa (alpha 1 thì rút gọn 6 ký tự).
export function ColorSwatch({ label, value, onChange }: ColorSwatchProps) {
  const [Picker, setPicker] = useState<HexAlphaPicker | null>(null);
  const [open, setOpen] = useState(false);
  const chipRef = useRef<HTMLDivElement>(null);

  // react-colorful chỉ cần lúc dev — dynamic import để prod không bundle:
  // DEV=false bị dead-code-eliminate, chunk không được sinh ra.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    import("react-colorful").then((m) =>
      setPicker(() => m.HexAlphaColorPicker)
    );
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (chipRef.current && !chipRef.current.contains(event.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div ref={chipRef} className={styles.bgPicker} title={label}>
      {label}
      <button
        type="button"
        className={styles.swatch}
        style={{ background: value }}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Mở picker ${label.toLowerCase()}`}
      />
      {open && Picker && (
        <div className={styles.pickerPop}>
          <Picker color={value} onChange={onChange} />
        </div>
      )}
    </div>
  );
}
