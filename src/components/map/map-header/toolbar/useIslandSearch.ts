import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { searchIslands } from "../../../../domain/selectors";
import { useFocusIsland } from "../../../../hooks/useFocusIsland";
import { useMapData } from "../../../../stores/dataset";
import { usePanel } from "../../../../stores/panel";
import { useSelection } from "../../../../stores/selection";

// Ô tìm đảo trên toolbar: query, danh sách kết quả và chọn kết quả bằng
// bàn phím (↑/↓ xoay vòng, Enter mở đảo, Esc xoá ô).
export function useIslandSearch() {
  const query = usePanel((state) => state.query);
  const setQuery = usePanel((state) => state.setQuery);
  const focusIsland = useFocusIsland();
  const { ownedIslands } = useMapData();
  const matches = useMemo(
    () => searchIslands(query, ownedIslands),
    [query, ownedIslands]
  );

  // Index được kẹp lại khi danh sách ngắn đi.
  const [activeIndex, setActiveIndex] = useState(0);
  const current = Math.min(activeIndex, Math.max(matches.length - 1, 0));
  const activeId = matches[current]?.id;

  // Option đang chọn → node trên canvas hiện viền hover; gỡ khi đổi option,
  // dropdown đóng (hết kết quả) hoặc toolbar unmount.
  useEffect(() => {
    if (!activeId) return;
    const { hover } = useSelection.getState();
    hover(activeId);
    return () => {
      if (useSelection.getState().hovered === activeId) hover(null);
    };
  }, [activeId]);

  const changeQuery = (value: string) => {
    setQuery(value);
    setActiveIndex(0);
  };

  const pick = (islandId: (typeof matches)[number]["id"]) => {
    focusIsland(islandId);
    setActiveIndex(0);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      changeQuery("");
      return;
    }
    if (!matches.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current + step + matches.length) % matches.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      pick(matches[current].id);
    }
  };

  return {
    query,
    matches,
    activeIndex: current,
    activeIsland: matches[current] as (typeof matches)[number] | undefined,
    setActiveIndex,
    changeQuery,
    pick,
    onKeyDown,
  };
}
