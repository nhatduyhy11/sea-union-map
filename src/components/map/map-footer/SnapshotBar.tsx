import { EVENT_DAYS, dayLabel, dayOfMonth } from "../../../data/eventCalendar";
import { hasSnapshot, LIVE_SERVER } from "../../../data/snapshots";
import { selectDay, today, useDataset } from "../../../stores/dataset";
import styles from "./SnapshotBar.module.css";

// Dãy nút 7 ngày event dưới legend canvas — xem lại diễn biến bản đồ theo
// ngày (snapshot cuối ngày) của cụm đang chọn. Trạng thái nút:
// - ngày chưa tới: xám, disable;
// - ngày hiện tại: live (cụm LIVE_SERVER) — cụm khác click thì store fallback
//   snapshot gần nhất;
// - ngày đã qua có snapshot: nút nổi;
// - ngày đã qua thiếu snapshot: flat (vẫn sáng), hover "Lịch sử lưu bị
//   thiếu", click → toast lỗi, không đổi màn hình.
export function SnapshotBar() {
  const server = useDataset((state) => state.server);
  const activeDay = useDataset((state) => state.day);
  const loading = useDataset((state) => state.loading);
  const current = today();

  return (
    <div className={styles.bar}>
      <span className={styles.label}>Lịch sử</span>
      {EVENT_DAYS.map((day) => {
        const future = day > current;
        const isToday = day === current;
        const missing = !future && !isToday && !hasSnapshot(day, server);
        const tip = future
          ? `${dayLabel(day)} · chưa tới`
          : missing
            ? "Lịch sử lưu bị thiếu"
            : isToday
              ? server === LIVE_SERVER
                ? `${dayLabel(day)} · hôm nay (live)`
                : `${dayLabel(day)} · cụm ${server} chưa hỗ trợ live — xem snapshot gần nhất`
              : `${dayLabel(day)} · snapshot`;
        const className = [
          styles.day,
          future && styles.future,
          missing && styles.missing,
          day === activeDay && styles.active,
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={day}
            className={className}
            disabled={future}
            aria-pressed={day === activeDay}
            data-tip={tip}
            aria-label={tip}
            onClick={() => selectDay(day)}
          >
            {dayOfMonth(day)}
            {isToday && <i className={styles.liveDot} />}
          </button>
        );
      })}
      {loading && <span className={styles.loading}>Đang tải…</span>}
    </div>
  );
}
