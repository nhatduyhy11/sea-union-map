import type { LucideIcon } from "lucide-react";
import { Flame, Snowflake, Sparkles, ZodiacAries } from "lucide-react";

export const FACTION_ICONS: Record<string, LucideIcon> = {
  east: ZodiacAries,
  south: Flame,
  north: Sparkles,
  west: Snowflake,
};

/**
 * Lấy icon Lucide tương ứng với phe:
 * - east (Vịnh Thao Thiết): ZodiacAries
 * - south (Long Khư U Ám): Flame
 * - north (Thần Tự Lấp Lánh): Sparkles
 * - west (Thánh Đảo Lạnh Giá): Snowflake
 */
export function getFactionIcon(
  factionIdOrName?: string | null
): LucideIcon | null {
  if (!factionIdOrName) return null;
  const key = factionIdOrName.replace(/^base-/, "").toLowerCase();
  if (FACTION_ICONS[key]) return FACTION_ICONS[key];

  if (key.includes("thao thiết") || key.includes("aries")) return ZodiacAries;
  if (key.includes("long khư") || key.includes("flame")) return Flame;
  if (key.includes("thần tự") || key.includes("sparkle")) return Sparkles;
  if (key.includes("thánh đảo") || key.includes("snow")) return Snowflake;

  return null;
}
