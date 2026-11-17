import {
  EVENT_ROUNDS,
  dayLabel,
  dayOfMonth,
  roundDays,
  roundLabel,
} from "../../../data/eventCalendar";
import { hasSnapshot, LIVE_SERVER } from "../../../data/snapshots";
import {
  selectDay,
  selectRound,
  today,
  useDataset,
} from "../../../stores/dataset";
import styles from "./SnapshotBar.module.css";

// Chọn đợt event + dãy nút các ngày của đợt dưới legend canvas — xem lại diễn
// biến bản đồ theo ngày (snapshot cuối ngày) của cụm đang chọn. Đợt chưa tới
// bị disable trong select. Trạng thái nút ngày:
// - ngày chưa tới: xám, disable;
// - ngày hiện tại: live (cụm LIVE_SERVER) — cụm khác click thì store fallback
//   snapshot gần nhất;
// - ngày đã qua có snapshot: nút nổi;
// - ngày đã qua thiếu snapshot: flat (vẫn sáng), hover "Lịch sử lưu bị
//   thiếu", click → toast lỗi, không đổi màn hình.
export function SnapshotBar() {
  const server = useDataset((state) => state.server);
  const round = useDataset((state) => state.round);
  const activeDay = useDataset((state) => state.day);
  const loading = useDataset((state) => state.loading);
  const current = today();

  return (
    <div className={styles.bar}>
      <span className={styles.label}>Lịch sử</span>
      <select
        className={styles.round}
        value={round}
        aria-label="Đợt event"
        title="Đợt event"
        onChange={(event) => selectRound(event.target.value)}
      >
        {[...EVENT_ROUNDS].reverse().map((option) => (
          <option key={option} value={option} disabled={option > current}>
            {roundLabel(option)}
          </option>
        ))}
      </select>
      {roundDays(round).map((day) => {
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
