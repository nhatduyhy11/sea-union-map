import { useEffect, useState } from "react";

// Debounce: trả về value chỉ sau khi nó đứng yên đủ delay ms (ví dụ ngừng kéo).
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}
