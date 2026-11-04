import { layoutNodes } from "../../../data/map-layout";
import styles from "./FactionBackdrop.module.css";

// Shift the large illustrations inward from the bases to fill the map's
// empty margins. This layer follows pan/zoom without affecting node bounds.
const artwork: Record<string, { file: string; dx: number; dy: number }> = {
  west: { file: "Thanh_dao", dx: 650, dy: 0 },
  south: { file: "Long_khu", dx: 10, dy: -600 },
  north: { file: "Than_tu", dx: 25, dy: 500 },
  east: { file: "Vinh_thao_thiet", dx: -650, dy: 0 },
};

export function FactionBackdrop() {
  return layoutNodes.flatMap((node) => {
    const art = node.base && node.owner ? artwork[node.owner] : undefined;
    if (!art) return [];
    return (
      <img
        key={node.id}
        className={styles.city}
        src={`${import.meta.env.BASE_URL}faction/${art.file}.webp`}
        alt=""
        draggable={false}
        decoding="async"
        style={{
          left: node.position.x + art.dx,
          top: node.position.y + art.dy,
        }}
      />
    );
  });
}
