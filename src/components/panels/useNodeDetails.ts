import { useMemo } from "react";
import { factions } from "../../data/factions";
import { nodeDetails, rankFactions } from "../../domain/selectors";
import { useDataset, useMapData } from "../../stores/dataset";
import { useSelection } from "../../stores/selection";
import type { Island } from "../../types";

// Chi tiết đảo đang chọn — Sidebar đọc để quyết định render gì, NodeDetails
// nhận kết quả làm prop.
export function useNodeDetails() {
  const selected = useSelection((state) => state.selected);
  const { contributions, ownedIslands } = useMapData();
  return useMemo(
    () => nodeDetails(selected, ownedIslands, contributions, factions),
    [selected, ownedIslands, contributions]
  );
}

// Căn cứ mặc định của tab Cứ điểm khi chưa chọn đảo: căn cứ xem gần nhất của
// cụm đang xem; chưa xem căn cứ nào thì căn cứ phe hạng 1 theo điểm phe, chưa
// phe nào có điểm thì Vịnh Thao Thiết (east). Layout luôn có đủ node
// base-<phe> nên luôn tìm được.
const FALLBACK_FACTION = "east";

export function useDefaultBase(): Island {
  const { factionBoard, ownedIslands } = useMapData();
  const server = useDataset((state) => state.server);
  const remembered = useSelection((state) => state.baseByServer[server]);
  return useMemo(() => {
    const findBase = (factionId: string) =>
      ownedIslands.find((node) => node.base && node.owner === factionId);
    const last = remembered && findBase(remembered);
    if (last) return last;
    const ranks = rankFactions(factionBoard.filter((entry) => entry.score > 0));
    const top = [...ranks].find(([, rank]) => rank === 1)?.[0];
    return (top && findBase(top)) || findBase(FALLBACK_FACTION)!;
  }, [factionBoard, ownedIslands, remembered]);
}
