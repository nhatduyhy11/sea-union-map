import { useMemo } from "react";
import { searchIslands } from "../../../domain/selectors";
import { useMapData } from "../../../stores/dataset";
import { usePanel } from "../../../stores/panel";

// Kết quả tìm kiếm đảo theo query hiện tại — chỉ toolbar cần.
export function useIslandMatches() {
  const query = usePanel((state) => state.query);
  const { ownedIslands } = useMapData();
  return useMemo(
    () => searchIslands(query, ownedIslands),
    [query, ownedIslands]
  );
}
