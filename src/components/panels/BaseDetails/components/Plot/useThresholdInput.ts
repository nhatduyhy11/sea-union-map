import { useState, type KeyboardEvent } from "react";
import {
  clampThreshold,
  formatThreshold,
  parseThreshold,
} from "./thresholdValue";

// State và xử lý của ô nhập ngưỡng (cú pháp ở parseThreshold, kẹp vào trục ở
// clampThreshold). Enter: hợp lệ thì áp, không thì báo lỗi và giữ ô để sửa.
// Rời ô: hợp lệ thì áp, không thì huỷ. Esc: huỷ (chặn lan ra phím Esc bỏ chọn
// đảo). onDone nhận giá trị đã kẹp, hoặc null khi huỷ / không hợp lệ.
export function useThresholdInput({
  value,
  range,
  onDone,
}: {
  value: number;
  range: { min: number; max: number };
  onDone: (value: number | null) => void;
}) {
  const [text, setText] = useState(formatThreshold(value));
  const [invalid, setInvalid] = useState(false);

  const commit = () => {
    const parsed = parseThreshold(text);
    onDone(parsed === null ? null : clampThreshold(parsed, range));
  };

  return {
    text,
    invalid,
    change: (next: string) => {
      setText(next);
      setInvalid(false);
    },
    commit,
    keyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        if (parseThreshold(text) === null) setInvalid(true);
        else event.currentTarget.blur();
      }
      if (event.key === "Escape") {
        event.stopPropagation();
        onDone(null);
      }
    },
  };
}
