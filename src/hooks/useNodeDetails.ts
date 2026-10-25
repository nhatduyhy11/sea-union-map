import { useMemo } from "react";
import { contributions } from "../data/demo";
import { factions } from "../data/factions";
import { nodeDetails } from "../domain/selectors";
import { claims, ownedIslands } from "../domain/mapData";
import { useSelection } from "../stores/selection";

// Chi tiết đảo đang chọn — Sidebar đọc để quyết định render gì, NodeDetails
// nhận kết quả làm prop.
export function useNodeDetails() {
  const selected = useSelection((state) => state.selected);
  return useMemo(
    () =>
      nodeDetails(
        selected,
        ownedIslands,
        contributions,
        factions,
        claims.connectedByNode
      ),
    [selected]
  );
}
