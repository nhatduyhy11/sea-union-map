import { useMapData } from "../../../stores/dataset";
import { useDebug } from "../../../stores/debug";
import { ColorSwatch } from "./ColorSwatch";
import { ServerSwitcher } from "./ServerSwitcher";
import styles from "./MapHeading.module.css";

export function MapHeading() {
  const { baseCount, ownedIslands } = useMapData();
  const debug = useDebug((state) => state.debug);
  const toggleDebug = useDebug((state) => state.toggleDebug);
  const canvasBg = useDebug((state) => state.canvasBg);
  const setCanvasBg = useDebug((state) => state.setCanvasBg);
  const neutralColor = useDebug((state) => state.neutralColor);
  const setNeutralColor = useDebug((state) => state.setNeutralColor);
  const neutralOpacity = useDebug((state) => state.neutralOpacity);
  const setNeutralOpacity = useDebug((state) => state.setNeutralOpacity);

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
        <div className={styles.titleRow}>
          <h1 className={styles.title}>
            Tranh bá Tứ Hải<span>01</span>
          </h1>
          <ServerSwitcher />
        </div>
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
