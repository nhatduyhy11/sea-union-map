import styles from "./Watermark.module.css";

export interface WatermarkProps {
  id?: string;
  className?: string;
  variant?: "badge" | "text";
}

export function Watermark({
  id,
  className,
  variant = "badge",
}: WatermarkProps) {
  const variantClass = variant === "text" ? styles.text : styles.badge;
  return (
    <p
      id={id}
      className={`${styles.watermark} ${variantClass} ${className ?? ""}`.trim()}
    >
      From <strong>HUNTERS [S517]</strong> with ❤️
    </p>
  );
}
