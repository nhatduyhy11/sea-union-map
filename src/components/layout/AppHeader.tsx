import { Anchor } from "lucide-react";
import { Watermark } from "../shared/Watermark";
import { EASTER_EGG_PLAYER_ID } from "../../stores/debug";
import styles from "./AppHeader.module.css";

export function AppHeader() {
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
    </header>
  );
}
