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
  const previousOwner = data.historyFrom?.factionInfo;
  const ownershipChange =
    previousOwner &&
    data.historyFrom?.owner !== data.owner &&
    (data.historySlot ?? 0) > 0;

  const labelClass = [
    styles.islandLabel,
    data.base && styles.base,
    isCenter && styles.center,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {data.historyFrom ? (
        <div className={styles.historyMarker}>
          <div
            className={styles.historyOld}
            data-history-effect={data.historyRetreat ? "retreat" : "exit"}
            data-history-delay={data.historyRetreat?.delay}
            data-history-duration={data.historyRetreat?.duration}
            data-history-slot={data.historySlot}
            aria-hidden
            inert
          >
            <MarkerGlyph
              data={data.historyFrom}
              layer
              state={state}
              open={open}
              ariaLabel={ariaLabel}
            />
          </div>
          <div
            className={styles.historyNew}
            data-history-effect="enter"
            data-history-delay={data.historyDelay}
            data-history-duration={data.historyDuration}
            data-history-slot={data.historySlot}
            style={{ clipPath: "circle(0px at 70px 42.5px)", opacity: 0 }}
          >
            <MarkerGlyph
              data={data}
              layer
              state={state}
              open={open}
              ariaLabel={ariaLabel}
            />
          </div>
        </div>
      ) : (
        <MarkerGlyph
          data={data}
          state={state}
          open={open}
          ariaLabel={ariaLabel}
        />
      )}
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
          {ownershipChange && (
            <small
              className={styles.ownerChange}
              aria-label={`${previousOwner.name} → ${data.factionInfo?.name ?? "không có phe giữ"}`}
              title={`${previousOwner.name} → ${data.factionInfo?.name ?? "không có phe giữ"}`}
            >
              <i style={{ background: previousOwner.color }} />→
              <i
                style={{ background: data.factionInfo?.color ?? "transparent" }}
              />
            </small>
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
