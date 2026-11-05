import {
  useLayoutEffect,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";

// Khoảng cách popover – nút và lề tối thiểu tới mép màn hình.
const GAP = 6;

// Vị trí cho popover `position: fixed` neo theo nút `anchor`: mặc định dưới
// nút, canh mép trái nút; tràn đáy màn hình mà phía trên đủ chỗ thì lật lên
// trên; kẹp ngang để không lòi ra mép phải. Tính lại khi scroll (capture,
// bắt cả vùng cuộn của panel chứa nút) và resize nên popover luôn bám nút.
// Chạy trong layout effect nên có vị trí trước frame đầu; trước lần đo đầu
// tiên trả style ẩn để popover không nháy ở góc màn hình.
export function useAnchoredPosition(
  open: boolean,
  anchor: RefObject<Element | null>,
  popover: RefObject<HTMLElement | null>
): CSSProperties {
  const [position, setPosition] = useState<CSSProperties>();

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = anchor.current?.getBoundingClientRect();
      const element = popover.current;
      if (!rect || !element) return;
      const height = element.offsetHeight;
      const below = rect.bottom + GAP;
      const above = rect.top - GAP - height;
      const top =
        below + height > window.innerHeight && above >= 0 ? above : below;
      const left = Math.max(
        GAP,
        Math.min(rect.left, window.innerWidth - element.offsetWidth - GAP)
      );
      setPosition({ top, left });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, anchor, popover]);

  return position ?? { visibility: "hidden" };
}
