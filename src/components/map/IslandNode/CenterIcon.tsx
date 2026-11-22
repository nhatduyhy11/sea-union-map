import { stateClasses, type MarkerState } from "./markerState";
import { CenterFlames } from "./CenterFlames";
import styles from "./CenterIcon.module.css";

// Trung tâm 4: ảnh đảo thay cho ô kim cương, hiệu ứng trạng thái là
// drop-shadow bám theo viền ảnh.
export function CenterIcon({
  state,
  onClick,
  ariaLabel,
}: {
  state: MarkerState;
  onClick: () => void;
  ariaLabel: string;
}) {
  const artClass = [styles.centerArt, ...stateClasses(styles, state)].join(" ");
  return (
    <button
      className={`${styles.centerIcon} nodrag`}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {/* Node giao tranh: cụm lửa đặt sau ảnh (z dưới .centerArt) — lửa nhô
          lên trên mái vòm, như đảo đang cháy. Unmount khi hết tranh chấp. */}
      {state.frontline && <CenterFlames />}
      <img
        className={artClass}
        src={`${import.meta.env.BASE_URL}aaa/center.webp`}
        alt=""
        draggable={false}
      />
    </button>
  );
}
