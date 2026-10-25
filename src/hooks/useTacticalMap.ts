import { useCallback, useMemo, useState } from "react";
import { routes, contributions } from "../data/demo";
import { factions } from "../data/factions";
import { nodeDetails, searchIslands } from "../domain/selectors";
import { buildMapEdges, buildMapNodes } from "../domain/mapGraph";
import {
  scoresByNode,
  leaderboard,
  factionBoard,
  nodeBoard,
  baseCount,
  ownedIslands,
  claims,
} from "../domain/mapData";
import { useIslandSelection } from "./useIslandSelection";

export type TacticalMapTab = "node" | "ranking";
// Top tabs của bảng xếp hạng — thứ tự UI: Phe trước (aggregate chính),
// rồi Cá nhân, Cứ điểm.
export type RankingBoard = "faction" | "player" | "node";

export function useTacticalMap() {
  const {
    selected,
    pinned,
    open,
    close,
    togglePin,
    clearPins,
    focus: focusNode,
  } = useIslandSelection();
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState("all");
  const [tab, setTab] = useState<TacticalMapTab>("node");
  const [board, setBoard] = useState<RankingBoard>("faction");
  const [debug, setDebug] = useState(false);
  const [query, setQuery] = useState("");
  const matches = useMemo(() => searchIslands(query, ownedIslands), [query]);

  const openIsland = useCallback(
    (id: string) => {
      open(id);
      setTab("node");
    },
    [open]
  );
  const closeIsland = close;
  // Filter phe ở legend đáy canvas là nguồn chân lý duy nhất: panel ranking
  // đọc cùng state nên sub-tab phe ở BXH Phe cũng lọc ngược canvas. Chọn phe
  // ở legend đồng thời kéo panel sang ranking, mở đúng tab phe đó.
  const selectFaction = useCallback((id: string) => {
    setFilter((previous) => (previous === id ? "all" : id));
    setTab("ranking");
    setBoard("faction");
  }, []);
  const toggleDebug = useCallback(() => setDebug((value) => !value), []);
  // focusNode chỉ mở node + dời camera; reset tab + dọn ô tìm kiếm thuộc
  // panel/search state, nên được compose ở đây nơi tab & query sống.
  const focusIsland = useCallback(
    (id: string) => {
      focusNode(id);
      setTab("node");
      setQuery("");
    },
    [focusNode, setTab]
  );

  const nodes = useMemo(
    () =>
      buildMapNodes(
        ownedIslands,
        scoresByNode,
        factions,
        { selected, pinned, showAll, filter, debug },
        { openIsland, togglePin }
      ),
    [selected, pinned, showAll, filter, debug, openIsland, togglePin]
  );
  const edges = useMemo(
    () => buildMapEdges(routes, ownedIslands, factions, filter),
    [filter]
  );
  const details = useMemo(
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

  return {
    nodes,
    edges,
    factions,
    leaderboard,
    factionBoard,
    nodeBoard,
    baseCount,
    islandCount: ownedIslands.length - baseCount,
    details,
    pinned,
    showAll,
    filter,
    debug,
    tab,
    board,
    query,
    matches,
    actions: {
      openIsland,
      closeIsland,
      togglePin,
      clearPins,
      selectFaction,
      toggleDebug,
      focusIsland,
      setShowAll,
      setTab,
      setBoard,
      setQuery,
    },
  };
}

export type TacticalMapResult = ReturnType<typeof useTacticalMap>;
