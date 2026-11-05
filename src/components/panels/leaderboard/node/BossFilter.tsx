import { useEffect, useRef, useState } from "react";
import { Skull, X } from "lucide-react";
import { bossImageUrl, bossName } from "../../../../data/nodeBosses";
import styles from "./BossFilter.module.css";

// Nút lọc boss đầu thanh sort: chưa lọc thì chỉ có icon; đang lọc thì sáng
// kèm số boss đã chọn và ✕ bỏ lọc. Bấm nút mở popover lưới avatar boss —
// avatar là ô bật/tắt; click ra ngoài hoặc Esc thì đóng.
export function BossFilter({
  options,
  selected,
  onToggle,
  onClear,
}: {
  options: number[];
  selected: ReadonlySet<number>;
  onToggle: (id: number) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = selected.size > 0;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node))
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

  if (options.length === 0) return null;
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
      {open && (
        <div className={styles.popover} role="dialog" aria-label="Lọc boss">
          <div className={styles.header}>
            <button type="button" disabled={!active} onClick={onClear}>
              Bỏ lọc
            </button>
          </div>
          <div className={styles.grid}>
            {options.map((id) => {
              const on = selected.has(id);
              const name = bossName(id);
              const head = bossImageUrl(id, "head");
              return (
                <button
                  key={id}
                  type="button"
                  className={on ? styles.on : ""}
                  aria-pressed={on}
                  aria-label={name}
                  title={name}
                  onClick={() => onToggle(id)}
                >
                  {head ? (
                    <img src={head} alt="" draggable={false} />
                  ) : (
                    <span>{id}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
