import { useEffect, useRef, useState, type ComponentType } from "react";
import { baseCount, ownedIslands } from "../../domain/mapData";
import { useMapView } from "../../stores/mapView";
import styles from "./MapHeading.module.css";

// HexAlphaColorPicker của react-colorful — chỉ dùng ở dev, load động.
type HexAlphaPicker = ComponentType<{
  color: string;
  onChange: (color: string) => void;
}>;

// Chip debug chọn màu: swatch mở popover react-colorful (màu + alpha trong
// một control); click ra ngoài tự đóng. value/onChange làm việc trên hex
// 6 hoặc 8 ký tự — picker trả #rrggbbaa (alpha 1 thì rút gọn 6 ký tự).
function ColorSwatch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex8: string) => void;
}) {
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

export function MapHeading() {
  const debug = useMapView((state) => state.debug);
  const toggleDebug = useMapView((state) => state.toggleDebug);
  const canvasBg = useMapView((state) => state.canvasBg);
  const setCanvasBg = useMapView((state) => state.setCanvasBg);
  const neutralColor = useMapView((state) => state.neutralColor);
  const setNeutralColor = useMapView((state) => state.setNeutralColor);
  const neutralOpacity = useMapView((state) => state.neutralOpacity);
  const setNeutralOpacity = useMapView((state) => state.setNeutralOpacity);

  // Picker làm việc trên #rrggbbaa; store tách thành màu + opacity 0..1.
  const alphaHex = Math.round(neutralOpacity * 255)
    .toString(16)
    .padStart(2, "0");
  const neutralHex8 = `${neutralColor}${alphaHex}`;
  const applyNeutral = (value: string) => {
    setNeutralColor(value.slice(0, 7));
    setNeutralOpacity(
      value.length >= 9 ? parseInt(value.slice(7, 9), 16) / 255 : 1
    );
  };

  return (
    <div className={styles.mapHeading}>
      <div>
        <div className={styles.eyebrow}>CHIẾN TRƯỜNG / TỔNG QUAN</div>
        <h1 className={styles.title}>
          Đại hải trình<span>01</span>
        </h1>
      </div>
      <div className={styles.headingMeta}>
        {/* Debug chỉ dành cho dev — Vite thay import.meta.env.DEV bằng false khi
            build, nên cụm debug (picker + nút) và chunk react-colorful bị loại
            khỏi bundle prod. */}
        {import.meta.env.DEV && (
          <div className={styles.debugGroup}>
            <ColorSwatch
              label="Nền canvas"
              value={canvasBg}
              onChange={setCanvasBg}
            />
            <ColorSwatch
              label="Trung lập"
              value={neutralHex8}
              onChange={applyNeutral}
            />
            <button
              className={`${styles.debugToggle} ${debug ? styles.debugOn : ""}`}
              onClick={toggleDebug}
              aria-pressed={debug}
              title="Hiện tâm node + đường dash ngang qua node 4 và đường dọc qua các cứ điểm trục giữa"
            >
              Debug tâm node
            </button>
          </div>
        )}
        <div className={styles.mapCount}>
          <b>{ownedIslands.length - baseCount}</b> cứ điểm <span>·</span>{" "}
          <b>{baseCount}</b> căn cứ
        </div>
      </div>
    </div>
  );
}
