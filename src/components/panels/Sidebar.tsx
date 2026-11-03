import { Flag, Trophy } from "lucide-react";
import { BaseDetails } from "./BaseDetails";
import { NodeDetails } from "./NodeDetails";
import { Leaderboard } from "./leaderboard/Leaderboard";
import { useDefaultBase, useNodeDetails } from "./useNodeDetails";
import { setPanelTab } from "../../stores/commands";
import { useSelection } from "../../stores/selection";
import { usePanel } from "../../stores/panel";
import styles from "./Sidebar.module.css";

// Panel tự đọc stores thay vì nhận props: tab & board (panel), chi tiết đảo
// & ghim (selection), lọc guild/player (mapView — Leaderboard tự subscribe).
export function Sidebar() {
  const tab = usePanel((state) => state.tab);
  const details = useNodeDetails();
  // Chưa chọn đảo: tab Cứ điểm mặc định là căn cứ phe top 1; click đảo / chấm
  // dot plot / carousel mới đè lên.
  const defaultBase = useDefaultBase();
  const pinned = useSelection((state) => state.pinned);
  const close = useSelection((state) => state.close);
  const togglePin = useSelection((state) => state.togglePin);
  return (
    <aside className={styles.sidebar}>
      <div className={styles.tabs}>
        <button
          className={tab === "ranking" ? styles.selected : ""}
          onClick={() => setPanelTab("ranking")}
        >
          <Trophy size={15} /> Xếp hạng
        </button>
        <button
          className={tab === "node" ? styles.selected : ""}
          onClick={() => setPanelTab("node")}
        >
          <Flag size={15} /> Cứ điểm
        </button>
      </div>
      <div className={styles.body}>
        {tab === "ranking" ? (
          <Leaderboard />
        ) : details?.island.base ? (
          <BaseDetails
            island={details.island}
            pinned={pinned.has(details.island.id)}
            onClose={close}
            onTogglePin={togglePin}
          />
        ) : details ? (
          <NodeDetails
            details={details}
            pinned={pinned.has(details.island.id)}
            onClose={close}
            onTogglePin={togglePin}
          />
        ) : (
          <BaseDetails
            island={defaultBase}
            pinned={pinned.has(defaultBase.id)}
            onTogglePin={togglePin}
          />
        )}
      </div>
    </aside>
  );
}
