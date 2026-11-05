import { stateClasses, type MarkerState } from "./markerState";
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
      <img
        className={artClass}
        src={`${import.meta.env.BASE_URL}aaa/center.png`}
        alt=""
        draggable={false}
      />
    </button>
  );
}
