import { useCornerDebug } from "../../../stores/cornerDebug";
import styles from "./SceneryBackdrop.module.css";

// Hero lấp phần trống còn lại ở 4 góc map, ngoài ảnh góc trang trí và minh hoạ
// phe. Ảnh, tâm, bề ngang và opacity từng góc lấy từ store (picker DEV chỉnh).
export function HeroBackdrop() {
  const corners = useCornerDebug((state) => state.corners);
  return corners.map((corner, index) =>
    corner.file ? (
      <img
        key={index}
        className={styles.scenery}
        src={`${import.meta.env.BASE_URL}${corner.file}`}
        alt=""
        draggable={false}
        decoding="async"
        style={{
          left: corner.x,
          top: corner.y,
          width: corner.width,
          opacity: corner.opacity,
        }}
      />
    ) : null
  );
}
