import { servers } from "../../../data/snapshots";
import { selectServer, useDataset } from "../../../stores/dataset";
import styles from "./ServerSwitcher.module.css";

// Chọn cụm server, dòng riêng dưới tiêu đề map. Danh sách tự lấy từ các snapshot đã có
// (src/data/snapshots) — không có nút tạo mới: data cụm chỉ sinh từ pipeline
// crawl nội bộ.
export function ServerSwitcher() {
  const active = useDataset((state) => state.server);
  return (
    <div className={styles.switcher} role="group" aria-label="Cụm server">
      {servers.map((server) => (
        <button
          key={server}
          className={server === active ? styles.active : ""}
          aria-pressed={server === active}
          onClick={() => selectServer(server)}
        >
          {server}
        </button>
      ))}
    </div>
  );
}
