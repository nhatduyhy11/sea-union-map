import { Anchor } from "lucide-react";
import { LIVE } from "../../domain/mapData";
import { Watermark } from "../shared/Watermark";
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
          <Watermark id="51921435" variant="badge" />
        </div>
      </div>
      <div className={styles.divider} />
      <span className={styles.title}>Bản đồ chiến thuật</span>
      <div className={styles.right}>
        <span className={styles.demoBadge}>
          <i /> {LIVE ? "LIVE · DỮ LIỆU CRAWL" : "DEMO / DỮ LIỆU MẪU"}
        </span>
        <span className={styles.version}>PHASE 01</span>
      </div>
    </header>
  );
}
