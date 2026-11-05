import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { Skull, X } from "lucide-react";
import { bossImageUrl, bossName } from "../../../../data/nodeBosses";
import type { BossOption } from "./useNodeBoardFilter";
import styles from "./BossFilter.module.css";

// Nút lọc boss đầu thanh sort: chưa lọc thì chỉ có icon; đang lọc thì sáng
// kèm số boss đã chọn và ✕ bỏ lọc. Bấm nút mở popover lưới avatar boss —
// avatar là ô bật/tắt, góc dưới ghi số cứ điểm mang boss đó trên map; boss
// không có trên map vẫn hiện nhưng khoá (không chọn được). Click ra ngoài
// hoặc Esc thì đóng. Popover render qua portal, position fixed neo theo nút
// để không bị vùng cuộn của panel cắt khi list ngắn; thiếu chỗ bên dưới thì
// lật lên trên nút.
export function BossFilter({
  options,
  selected,
  onToggle,
  onClear,
}: {
  options: BossOption[];
  selected: ReadonlySet<number>;
  onToggle: (id: number) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties>();
  const active = selected.size > 0;

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = rootRef.current?.getBoundingClientRect();
      const popover = popoverRef.current;
      if (!anchor || !popover) return;
      const gap = 6;
      const height = popover.offsetHeight;
      const below = anchor.bottom + gap;
      const top =
        below + height > window.innerHeight && anchor.top - gap - height >= 0
          ? anchor.top - gap - height
          : below;
      const left = Math.max(
        gap,
        Math.min(anchor.left, window.innerWidth - popover.offsetWidth - gap)
      );
      setPosition({ top, left });
    };
    place();
    // Capture để bắt cả scroll của panel chứa nút.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      )
        setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    // Capture trước khi canvas chặn event để xử lý pan/drag.
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!options.some((option) => option.count > 0)) return null;
  return (
    <div ref={rootRef} className={styles.root}>
      <div className={`${styles.trigger} ${active ? styles.active : ""}`}>
        <button
          type="button"
          className={styles.open}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label="Lọc theo boss"
          title={active ? `Đang lọc ${selected.size} boss` : "Lọc theo boss"}
          onClick={() => setOpen((value) => !value)}
        >
          <Skull size={11} aria-hidden="true" />
          {active && <b>{selected.size}</b>} Boss
        </button>
        {active && (
          <button
            type="button"
            className={styles.clear}
            aria-label="Bỏ lọc boss"
            title="Bỏ lọc boss"
            onClick={onClear}
          >
            <X size={10} />
          </button>
        )}
      </div>
      {open &&
        createPortal(
          <div
            ref={popoverRef}
            className={styles.popover}
            style={position ?? { visibility: "hidden" }}
            role="dialog"
            aria-label="Lọc boss"
          >
            <div className={styles.header}>
              <button type="button" disabled={!active} onClick={onClear}>
                Bỏ lọc
              </button>
            </div>
            <div className={styles.grid}>
              {options.map(({ id, count }) => {
                const on = selected.has(id);
                const name = bossName(id);
                const head = bossImageUrl(id, "head");
                const label =
                  count > 0
                    ? `${name} · ${count} cứ điểm`
                    : `${name} · không có trên map`;
                return (
                  <button
                    key={id}
                    type="button"
                    className={on ? styles.on : ""}
                    disabled={count === 0}
                    aria-pressed={on}
                    aria-label={label}
                    title={label}
                    onClick={() => onToggle(id)}
                  >
                    {head ? (
                      <img src={head} alt="" draggable={false} />
                    ) : (
                      <span>{id}</span>
                    )}
                    {count > 0 && <span className={styles.count}>{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
