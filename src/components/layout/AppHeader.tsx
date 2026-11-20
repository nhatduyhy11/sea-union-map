import { Anchor, Moon, Sun } from "lucide-react";
import { Watermark } from "../shared/Watermark";
import { EASTER_EGG_PLAYER_ID } from "../../stores/debug";
import { useTheme } from "../../stores/theme";
import styles from "./AppHeader.module.css";

export function AppHeader() {
  const { theme, toggleTheme } = useTheme();
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <div className={styles.brandIcon}>
          <Anchor size={25} />
        </div>
        <div>
          SEAWIDE SHOWDOWN
          {/* Easter egg: dev in-game id */}
          <Watermark id={EASTER_EGG_PLAYER_ID} variant="badge" />
        </div>
      </div>
      <div className={styles.divider} />
      <span className={styles.title}>Bản đồ chiến thuật</span>
      <button
        type="button"
        className={styles.themeToggle}
        onClick={toggleTheme}
        aria-label="Chế độ tối"
        aria-pressed={theme === "dark"}
        title={
          theme === "dark"
            ? "Chuyển sang chế độ sáng"
            : "Chuyển sang chế độ tối"
        }
      >
        {theme === "dark" ? (
          <Sun size={18} aria-hidden="true" />
        ) : (
          <Moon size={18} aria-hidden="true" />
        )}
        <span>{theme === "dark" ? "Sáng" : "Tối"}</span>
      </button>
    </header>
  );
}
