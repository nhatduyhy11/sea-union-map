import {
  BicepsFlexed,
  Flag,
  Gift,
  Swords,
  type LucideIcon,
} from "lucide-react";
import type { CanvasIcon } from "../../types";

// Trạng thái icon canvas mà panel hiện thành icon / pill filter (BXH Cứ điểm,
// chi tiết căn cứ) — cùng icon với node trên map.
export type NodeStatus = Extract<
  CanvasIcon,
  "frontline" | "overbuilt" | "gifted" | "aftermath"
>;

export const NODE_STATUS: Record<
  NodeStatus,
  { Icon: LucideIcon; label: string }
> = {
  frontline: { Icon: Swords, label: "Tranh" },
  overbuilt: { Icon: BicepsFlexed, label: "Dồn" },
  gifted: { Icon: Gift, label: "Cướp" },
  aftermath: { Icon: Flag, label: "Vết" },
};

export const NODE_STATUSES = Object.keys(NODE_STATUS) as NodeStatus[];

export function isNodeStatus(icon: CanvasIcon | undefined): icon is NodeStatus {
  return icon !== undefined && icon in NODE_STATUS;
}
