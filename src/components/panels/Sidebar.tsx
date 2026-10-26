import { Compass, Flag, RotateCcw, Trophy } from "lucide-react";
import { NodeDetails } from "./NodeDetails";
import { Leaderboard } from "./leaderboard/Leaderboard";
import { useNodeDetails } from "../../hooks/useNodeDetails";
import { setPanelTab } from "../../stores/commands";
import { useSelection } from "../../stores/selection";
import { usePanel } from "../../stores/panel";
import styles from "./Sidebar.module.css";

// Panel tự đọc stores thay vì nhận props: tab & board (panel), chi tiết đảo
// & ghim (selection), lọc guild/player (mapView — Leaderboard tự subscribe).
export function Sidebar() {
  const tab = usePanel((state) => state.tab);
  const details = useNodeDetails();
  const pinned = useSelection((state) => state.pinned);
  const close = useSelection((state) => state.close);
  const togglePin = useSelection((state) => state.togglePin);
  const clearPins = useSelection((state) => state.clearPins);
  return (
    <aside className={styles.sidebar}>
      <div className={styles.tabs}>
        <button
          className={tab === "node" ? styles.selected : ""}
          onClick={() => setPanelTab("node")}
        >
          <Flag size={15} /> Cứ điểm
        </button>
        <button
          className={tab === "ranking" ? styles.selected : ""}
          onClick={() => setPanelTab("ranking")}
        >
          <Trophy size={15} /> Xếp hạng
        </button>
      </div>
      {tab === "ranking" ? (
        <Leaderboard />
      ) : details ? (
        <NodeDetails
          details={details}
          pinned={pinned.has(details.island.id)}
          onClose={close}
          onTogglePin={togglePin}
        />
      ) : (
        <div className={styles.empty}>
          <Compass size={40} />
          <h2>Khám phá chiến trường</h2>
          <p>Chọn một đảo trên map để xem điểm các phe và người chơi.</p>
        </div>
      )}
      <div className={styles.foot}>
        <span>
          <i /> Dữ liệu minh họa
        </span>
        <button
          title="Bỏ tất cả ghim"
          aria-label="Bỏ tất cả ghim"
          onClick={clearPins}
        >
          <RotateCcw size={14} />
        </button>
        <small>Điểm tổng được tính từ đóng góp tại từng đảo.</small>
      </div>
    </aside>
  );
}
