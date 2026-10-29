import { useToast } from "../../stores/toast";
import styles from "./ToastHost.module.css";

// Vùng hiển thị toast (fixed, giữa đáy màn hình) — mount một lần ở App.
export function ToastHost() {
  const toasts = useToast((state) => state.toasts);
  const dismiss = useToast((state) => state.dismiss);
  if (toasts.length === 0) return null;
  return (
    <div className={styles.host} role="status" aria-live="polite">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          className={`${styles.toast} ${styles[toast.kind]}`}
          onClick={() => dismiss(toast.id)}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}
