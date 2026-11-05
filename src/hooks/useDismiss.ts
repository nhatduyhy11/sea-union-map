import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

// Đóng popover / note đang mở khi pointerdown ra ngoài mọi phần tử trong
// `inside` (nút mở, popover — kể cả popover portal ra ngoài nút) hoặc bấm Esc.
// Pointerdown nghe ở pha capture vì canvas chặn event để xử lý pan/drag.
// `inside` / `onClose` lấy bản mới nhất mỗi render, không cần ổn định.
export function useDismiss(
  open: boolean,
  inside: readonly RefObject<Element | null>[],
  onClose: () => void
) {
  const latest = useRef({ inside, onClose });
  useLayoutEffect(() => {
    latest.current = { inside, onClose };
  });

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const { inside, onClose } = latest.current;
      if (!inside.some((ref) => ref.current?.contains(target))) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") latest.current.onClose();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);
}
