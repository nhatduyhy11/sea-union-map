import { useEffect, useRef, useState, type ComponentType } from "react";
import styles from "./ColorSwatch.module.css";

// HexAlphaColorPicker của react-colorful — DEV hoặc sau easter egg, load động.
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

  // Swatch chỉ mount ở DEV hoặc sau easter egg — dynamic import để react-colorful
  // thành chunk riêng, user thường không tải. Lỗi tải (vd 404 chunk cũ sau
  // deploy) thì nuốt: popover không mở, trang không crash.
  useEffect(() => {
    import("react-colorful")
      .then((m) => setPicker(() => m.HexAlphaColorPicker))
      .catch(() => {});
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
          {/* Mã hex đúng như giá trị đưa vào canvas — click để chọn hết & copy. */}
          <input
            className={styles.hexValue}
            value={value}
            readOnly
            onFocus={(e) => e.currentTarget.select()}
            aria-label={`Mã màu ${label.toLowerCase()}`}
          />
        </div>
      )}
    </div>
  );
}
