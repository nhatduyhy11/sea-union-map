import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Info } from "lucide-react";
import { useDismiss } from "../../hooks/useDismiss";
import styles from "./InfoHint.module.css";

// Lề hai bên của note so với mép panel chứa icon.
const GUTTER = 12;

// Panel chứa icon = tổ tiên gần nhất có cuộn dọc; không có thì lấy viewport.
function panelRect(from: HTMLElement): { left: number; width: number } {
  for (let node = from.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, width: rect.width };
    }
  }
  return { left: 0, width: window.innerWidth };
}

// Icon (i) cạnh tiêu đề: hover hiện note, click ghim note mở (click ngoài /
// Esc để đóng — cho cả màn hình cảm ứng không có hover). Note là `fixed`, bám
// mép trái panel và rộng tối đa bằng panel nên không đẩy panel cuộn ngang.
export function InfoHint({
  label = "Ghi chú",
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const open = pinned || hovered;

  const place = useCallback(() => {
    const trigger = ref.current;
    if (!trigger) return;
    const icon = trigger.getBoundingClientRect();
    const panel = panelRect(trigger);
    setPosition({
      top: icon.bottom + 6,
      left: panel.left + GUTTER,
      maxWidth: Math.max(panel.width - GUTTER * 2, 0),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    // Panel cuộn / resize thì note đi theo icon.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  useDismiss(pinned, [ref], () => setPinned(false));

  return (
    <span
      ref={ref}
      className={styles.hint}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.active : ""}`}
        aria-label={label}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setPinned((value) => !value);
        }}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      >
        <Info size={12} />
      </button>
      {open && position && (
        <span role="tooltip" className={styles.bubble} style={position}>
          {children}
        </span>
      )}
    </span>
  );
}
