import {
  Anchor,
  BicepsFlexed,
  Castle,
  Flag,
  Gift,
  Scissors,
  ShieldAlert,
  Sword,
  Swords,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";
import type { CanvasIcon } from "../../../domain/selectors/canvasIcons";
import type { IslandNodeData } from "../../../types";
import { getFactionIcon } from "../../shared/faction/factionIcons";
import { CenterIcon } from "./CenterIcon";
import { stateClasses, type MarkerState } from "./markerState";
import styles from "./MarkerGlyph.module.css";

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

export function MarkerGlyph({
  data,
  state,
  open,
  ariaLabel,
  layer = false,
}: {
  data: IslandNodeData;
  state: MarkerState;
  open: () => void;
  ariaLabel: string;
  layer?: boolean;
}) {
  state = {
    ...state,
    frontline: Boolean(data.frontline),
    defend: Boolean(data.defend),
  };
  const isCenter = data.tier === 4;
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

  return (
    <div
      style={
        {
          "--faction":
            data.factionInfo?.color ?? "var(--history-neutral, #9caeb9)",
          opacity: layer && !data.owner ? "var(--neutral-opacity, 0.4)" : 1,
        } as CSSProperties
      }
    >
      {isCenter ? (
        <CenterIcon state={state} onClick={open} ariaLabel={ariaLabel} />
      ) : (
        <button className={iconClass} onClick={open} aria-label={ariaLabel}>
          {Icon && <Icon size={data.base ? 31 : 24} />}
        </button>
      )}
    </div>
  );
}
