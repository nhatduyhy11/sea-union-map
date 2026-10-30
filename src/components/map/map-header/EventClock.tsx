import { useEffect, useState } from "react";
import { battleCountdown } from "../../../data/eventCalendar";
import styles from "./EventClock.module.css";

const pad = (n: number) => String(n).padStart(2, "0");

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${pad(h)}:${pad(m)}:${pad(total % 60)}`;
}

// Đồng hồ đếm ngược chiến trường, cuối dòng server (rule ở battleCountdown).
export function EventClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const countdown = battleCountdown(now);
  if (countdown.phase === "ended") {
    return <div className={styles.clock}>Event kết thúc</div>;
  }
  const open = countdown.phase === "open";
  return (
    <div
      className={`${styles.clock} ${open ? styles.open : ""}`}
      title={open ? "Chiến trường đóng lúc 22:00" : "Chiến trường mở lúc 10:00"}
    >
      <span className={styles.label}>{open ? "Đóng sau" : "Mở sau"}</span>
      <span className={styles.time}>
        {formatRemaining(countdown.target.getTime() - now.getTime())}
      </span>
    </div>
  );
}
