import {
  Anchor,
  BicepsFlexed,
  Castle,
  Flag,
  Gift,
  Pin,
  Scissors,
  ShieldAlert,
  Sword,
  Swords,
  type LucideIcon,
} from "lucide-react";
import type { CanvasIcon } from "../../../domain/selectors/canvasIcons";
import { getFactionIcon } from "../../shared/faction/factionIcons";
import { CenterIcon } from "./CenterIcon";
import { stateClasses, type MarkerState } from "./markerState";
import styles from "./IslandMarker.module.css";
import type { IslandNodeData } from "../../../types";

const STATUS_ICONS: Record<CanvasIcon, LucideIcon | null> = {
  base: null,
  anchor: Anchor,
  castle: Castle,
  belowClaim: Sword,
  frozen: Scissors,
  frontline: Swords,
  defend: ShieldAlert,
  gifted: Gift,
  aftermath: Flag,
  overbuilt: BicepsFlexed,
  plain: null,
};

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

  const FactionIcon = data.base
    ? getFactionIcon(data.factionInfo?.id ?? data.owner ?? data.id)
    : null;
  const Icon =
    FactionIcon ??
    (data.canvasIcon
      ? STATUS_ICONS[data.canvasIcon]
      : data.owner
        ? null
        : data.central
          ? Castle
          : Anchor);

  const iconClass = [
    styles.islandIcon,
    "nodrag",
    data.base && styles.base,
    ...stateClasses(styles, state),
  ]
    .filter(Boolean)
    .join(" ");
  const labelClass = [
    styles.islandLabel,
    data.base && styles.base,
    isCenter && styles.center,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {isCenter ? (
        <CenterIcon state={state} onClick={open} ariaLabel={ariaLabel} />
      ) : (
        <button className={iconClass} onClick={open} aria-label={ariaLabel}>
          {Icon && <Icon size={data.base ? 31 : 24} />}
        </button>
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
