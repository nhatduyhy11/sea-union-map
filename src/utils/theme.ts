// Keep faction text readable on dark surfaces while retaining its hue.
export function factionTextColor(color: string | undefined) {
  return color
    ? `color-mix(in srgb, ${color}, white var(--faction-text-lift, 0%))`
    : undefined;
}
