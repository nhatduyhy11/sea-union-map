import styles from "./SceneryBackdrop.module.css";

// World coordinates keep the scenery anchored while panning/zooming. The
// corners fill the gaps outside the four faction illustrations.
const scenery = [
  // The bow points southeast, toward the center of the map.
  {
    file: "corner-abot-left.webp",
    x: -1400,
    y: -1150,
    width: 600,
    rotation: 0,
  },
  { file: "corner-top-right.webp", x: 1400, y: -1150, width: 600, rotation: 0 },
  { file: "corner-bot-left.webp", x: -1400, y: 1150, width: 700, rotation: 0 },
  { file: "corner-bot-right.webp", x: 1400, y: 1150, width: 600, rotation: 0 },
] as const;

export function SceneryBackdrop() {
  return scenery.map(({ file, x, y, width, rotation }) => (
    <img
      key={file}
      className={styles.scenery}
      src={`${import.meta.env.BASE_URL}aaa/${file}`}
      alt=""
      draggable={false}
      decoding="async"
      style={{
        left: x,
        top: y,
        width,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
      }}
    />
  ));
}
