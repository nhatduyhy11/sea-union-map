import type { CSSProperties } from "react";
import styles from "./CenterFlames.module.css";

// Cụm lửa trên node trung tâm đang tranh chấp (frontline) — purely decorative,
// đặt sau ảnh đảo trong nút của CenterIcon: lửa nhô lên trên mái vòm như đảo
// đang cháy. Cha quyết định lúc mount (state.frontline), component không nhận
// props.
export function CenterFlames() {
  // URL ảnh đảo cho mask khoét phần lửa nằm sau thân đảo (xem .flames).
  const artUrl = `${import.meta.env.BASE_URL}aaa/center.webp`;
  return (
    <span
      className={styles.flames}
      aria-hidden="true"
      style={{ "--center-art": `url(${artUrl})` } as CSSProperties}
    >
      <span className={styles.flame} />
      <span className={styles.flame} />
      <span className={styles.flame} />
    </span>
  );
}
