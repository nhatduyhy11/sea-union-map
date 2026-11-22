import { Pause, Play, RotateCcw, Square } from "lucide-react";
import { dayLabel } from "../../../data/eventCalendar";
import { hasSnapshot } from "../../../data/snapshots";
import { historyDays } from "../../../domain/historyPlayback";
import { today, useDataset } from "../../../stores/dataset";
import {
  historyLabel,
  stopHistory,
  toggleHistory,
  useHistoryPlayback,
} from "../../../stores/historyPlayback";
import styles from "./HistoryControls.module.css";

export function HistoryPlayButton() {
  const server = useDataset((state) => state.server);
  const round = useDataset((state) => state.round);
  const loading = useDataset((state) => state.loading);
  const status = useHistoryPlayback((state) => state.status);
  const duration = useHistoryPlayback((state) => state.duration);
  const { days } = historyDays(round, today(), (day) =>
    hasSnapshot(day, server)
  );
  const label =
    status === "playing"
      ? "Tạm dừng lịch sử"
      : status === "paused"
        ? "Tiếp tục lịch sử"
        : status === "ended"
          ? "Phát lại lịch sử"
          : "Phát lịch sử";
  const Icon =
    status === "playing" ? Pause : status === "ended" ? RotateCcw : Play;
  return (
    <>
      <button
        className={styles.play}
        onClick={toggleHistory}
        disabled={loading || days.length < 2 || status === "loading"}
        aria-label={label}
        title={`${label} · ${days.length} bản lưu · POC`}
      >
        <Icon size={13} />
      </button>
      {(status === "playing" ||
        status === "paused" ||
        status === "loading") && (
        <button
          className={styles.play}
          onClick={stopHistory}
          aria-label="Dừng lịch sử"
          title="Dừng ở bản lưu đã hoàn tất"
        >
          <Square size={11} />
        </button>
      )}
      <select
        className={styles.speed}
        aria-label="Thời lượng mỗi ngày"
        value={duration}
        disabled={status !== "idle" && status !== "ended"}
        title="Chọn thời lượng cho lượt phát kế tiếp"
        onChange={(event) =>
          useHistoryPlayback.setState({ duration: Number(event.target.value) })
        }
      >
        <option value={2000}>2s/ngày</option>
        <option value={3000}>3s/ngày</option>
        <option value={4000}>4s/ngày</option>
      </select>
    </>
  );
}

export function HistoryProgress() {
  const state = useHistoryPlayback();
  if (state.status === "idle") return null;
  return (
    <div className={styles.progress}>
      <span className={styles.label} aria-live="polite">
        {historyLabel(state)}
      </span>
      <div
        className={styles.track}
        role="progressbar"
        aria-label="Tiến độ ngày đang phát"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={state.status === "ended" ? 100 : 0}
      >
        <i
          data-history-progress
          style={{ transform: `scaleX(${state.status === "ended" ? 1 : 0})` }}
        />
      </div>
      <span className={styles.note}>
        POC · chuyển giữa các bản lưu
        {state.missing.length
          ? ` · thiếu ${state.missing.map(dayLabel).join(", ")}`
          : ""}
      </span>
      {state.status === "ended" && state.metrics && (
        <span
          className={styles.note}
          title={`${state.metrics.frames} mẫu rAF, ${state.metrics.slow} mẫu trên 33,4ms; không phải số đo GPU`}
        >
          p95 {state.metrics.p95.toFixed(1)}ms/khung
        </span>
      )}
    </div>
  );
}
