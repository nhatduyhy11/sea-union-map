import { Anchor, Monitor, Moon, Sun } from "lucide-react";
import { Watermark } from "../shared/Watermark";
import { EASTER_EGG_PLAYER_ID } from "../../stores/debug";
import { useTheme, type ThemePreference } from "../../stores/theme";
import styles from "./AppHeader.module.css";

export function AppHeader() {
  const { preference, setPreference } = useTheme();
  const ThemeIcon =
    preference === "system" ? Monitor : preference === "dark" ? Moon : Sun;
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
      <label className={styles.themeToggle} title="Chọn giao diện">
        <ThemeIcon size={18} aria-hidden="true" />
        <select
          aria-label="Giao diện"
          value={preference}
          onChange={(event) =>
            setPreference(event.target.value as ThemePreference)
          }
        >
          <option value="system">Hệ thống</option>
          <option value="light">Sáng</option>
          <option value="dark">Tối</option>
        </select>
      </label>
    </header>
  );
}
