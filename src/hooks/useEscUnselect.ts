import { useEffect } from "react";
import { useSelection } from "../stores/selection";
import { useFitMap } from "./useFitMap";

const UNSELECT_FIT_DURATION = 500;

// Esc đã được một thành phần của app dùng cho việc riêng (đóng popover, xoá ô
// tìm đảo). Dấu riêng của app thay vì event.defaultPrevented: extension trình
// duyệt có thể preventDefault mọi phím Esc, làm lệnh bỏ chọn không bao giờ chạy.
const handledEsc = new WeakSet<Event>();

export function markEscHandled(event: Event) {
  handledEsc.add(event);
}

// Esc khi đang chọn đảo: bỏ chọn + zoom ra toàn map (mượt), focus đang ở đâu
// cũng vậy (node, checkbox, ô tìm đảo trống…). Nghe trên window (bubble) để
// chạy sau mọi listener khác; Esc đã markEscHandled thì bỏ qua.
export function useEscUnselect() {
  const fitMap = useFitMap(UNSELECT_FIT_DURATION);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || handledEsc.has(event)) return;
      if (useSelection.getState().selected === null) return;
      useSelection.getState().close();
      void fitMap();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fitMap]);
}
