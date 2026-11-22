import { Pin } from "lucide-react";
import type { IslandNodeData } from "../../../types";
import type { MarkerState } from "./markerState";
import { MarkerGlyph } from "./MarkerGlyph";
import styles from "./IslandMarker.module.css";

// Icon (ô kim cương, hoặc ảnh đảo với trung tâm 4) + nhãn tên và nút ghim.
export function IslandMarker({
  data,
  hovered,
  linked,
}: {
  data: IslandNodeData;
  hovered: boolean;
  linked: boolean;
}) {
  const isCenter = data.tier === 4;
  const state: MarkerState = {
    hovered,
    linked,
    active: data.active,
    hot: Boolean(data.matched),
    frontline: Boolean(data.frontline),
    defend: Boolean(data.defend),
  };
  const open = () => data.open(data.id);
  const ariaLabel = `Xem ${data.id} ${data.name}`;

  const labelClass = [
    styles.islandLabel,
    data.base && styles.base,
    isCenter && styles.center,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <MarkerGlyph
        data={data}
        state={state}
        open={open}
        ariaLabel={ariaLabel}
      />
      <div className={labelClass}>
        <div className={styles.labelWrapper}>
          {data.base ? (
            // Base chỉ hiện tên in-game ("Vịnh Thao Thiết"...), không id/hướng.
            data.name
          ) : (
            <>
              <span>{data.id}</span> {isCenter ? "TRUNG TÂM" : ""}
            </>
          )}
          <button
            className={`${styles.pin} nodrag ${data.pinned ? styles.pinned : ""}`}
            aria-label={`${data.pinned ? "Bỏ ghim" : "Ghim"} ${data.id}`}
            aria-pressed={data.pinned}
            onClick={() => data.pin(data.id)}
          >
            <Pin size={13} />
          </button>
        </div>
      </div>
    </>
  );
}
