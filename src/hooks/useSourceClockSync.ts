import { useEffect } from "react";
import { syncSourceWithClock } from "../stores/dataset";

// Đồng hồ đổi pha war (10:00 mở / 22:00 đóng) không ai bấm gì cả — mount thì
// sync nguồn theo resolve (mở trang ngoài khung: load snapshot hôm nay đè bản
// live init), rồi tick 30s để tự chỉnh khi qua mốc. Store giữ rule, hook chỉ
// nhắc store nhìn đồng hồ.
const CLOCK_TICK_MS = 30_000;

export function useSourceClockSync() {
  useEffect(() => {
    syncSourceWithClock();
    const id = setInterval(syncSourceWithClock, CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);
}
