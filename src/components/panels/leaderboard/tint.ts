import type { CSSProperties } from "react";

// Inline style cho shared .tintedSummary: nền nhạt + viền trái màu phe.
// Không màu = giữ viền trong suốt mặc định.
export function tintStyle(color?: string): CSSProperties | undefined {
  return color
    ? { background: `${color}14`, borderLeftColor: color }
    : undefined;
}
