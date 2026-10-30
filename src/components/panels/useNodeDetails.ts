import { useMemo } from "react";
import { factions } from "../../data/factions";
import { nodeDetails } from "../../domain/selectors";
import { useMapData } from "../../stores/dataset";
import { useSelection } from "../../stores/selection";

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
