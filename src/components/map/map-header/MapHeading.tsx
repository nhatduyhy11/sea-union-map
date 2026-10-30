import { useDebug } from "../../../stores/debug";
import { ColorSwatch } from "./ColorSwatch";
import { EventClock } from "./EventClock";
import { ServerSwitcher } from "./ServerSwitcher";
import styles from "./MapHeading.module.css";

export function MapHeading() {
  const debug = useDebug((state) => state.debug);
  const toggleDebug = useDebug((state) => state.toggleDebug);
  const canvasBg = useDebug((state) => state.canvasBg);
  const setCanvasBg = useDebug((state) => state.setCanvasBg);
  const neutralColor = useDebug((state) => state.neutralColor);
  const setNeutralColor = useDebug((state) => state.setNeutralColor);
  const neutralOpacity = useDebug((state) => state.neutralOpacity);
  const setNeutralOpacity = useDebug((state) => state.setNeutralOpacity);
  const paletteUnlocked = useDebug((state) => state.paletteUnlocked);
  const showPalette = import.meta.env.DEV || paletteUnlocked;

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
      <div className={styles.topRow}>
        <div>
          <div className={styles.eyebrow}>CHIẾN TRƯỜNG / TỔNG QUAN</div>
          <h1 className={styles.title}>Tranh bá Tứ Hải</h1>
        </div>
        <div className={styles.headingMeta}>
          {/* Picker màu: DEV, hoặc prod sau khi mở easter egg (BXH cá nhân).
            Nút debug tâm node chỉ DEV — Vite thay import.meta.env.DEV bằng
            false khi build nên nút bị loại khỏi bundle prod. */}
          {showPalette && (
            <div className={styles.debugGroup}>
              <ColorSwatch
                label="Nền"
                value={canvasBg}
                onChange={setCanvasBg}
              />
              <ColorSwatch
                label="Đảo"
                value={neutralHex8}
                onChange={applyNeutral}
              />
              {import.meta.env.DEV && (
                <button
                  className={`${styles.debugToggle} ${debug ? styles.debugOn : ""}`}
                  onClick={toggleDebug}
                  aria-pressed={debug}
                  title="Hiện tâm node + đường dash ngang qua node 4 và đường dọc qua các cứ điểm trục giữa"
                >
                  Lưới
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className={styles.serverRow}>
        <ServerSwitcher />
        <EventClock />
      </div>
    </div>
  );
}
