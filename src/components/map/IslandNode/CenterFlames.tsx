import styles from "./CenterFlames.module.css";

// Cụm lửa trên node trung tâm đang tranh chấp (frontline) — purely decorative,
// đặt sau ảnh đảo trong nút của CenterIcon: lửa nhô lên trên mái vòm như đảo
// đang cháy. Cha quyết định lúc mount (state.frontline), component không nhận
// props.
export function CenterFlames() {
  return (
    <span className={styles.flames} aria-hidden="true">
      <span className={styles.flame} />
      <span className={styles.flame} />
      <span className={styles.flame} />
    </span>
  );
}
