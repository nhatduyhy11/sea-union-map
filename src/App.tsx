import { useTacticalMap } from "./hooks/useTacticalMap";
import { AppHeader } from "./components/layout/AppHeader";
import { NavigationRail } from "./components/layout/NavigationRail";
import { MapHeading } from "./components/map/MapHeading";
import { MapToolbar } from "./components/map/MapToolbar";
import { MapCanvas } from "./components/map/MapCanvas";
import { FactionLegend } from "./components/map/FactionLegend";
import { Sidebar } from "./components/panels/Sidebar";
import styles from "./App.module.css";

export function App() {
  const map = useTacticalMap();
  const { actions } = map;
  return (
    <div className={styles.app}>
      <AppHeader />
      <div className={styles.workspace}>
        <NavigationRail onShowRanking={() => actions.setTab("ranking")} />
        <main className={styles.mainContent}>
          <MapHeading
            islandCount={map.islandCount}
            baseCount={map.baseCount}
            debug={map.debug}
            onToggleDebug={actions.toggleDebug}
          />
          <MapToolbar
            query={map.query}
            matches={map.matches}
            showAll={map.showAll}
            onQueryChange={actions.setQuery}
            onFocusIsland={actions.focusIsland}
            onShowAllChange={actions.setShowAll}
          />
          <MapCanvas nodes={map.nodes} edges={map.edges} debug={map.debug} />
          <FactionLegend
            factions={map.factions}
            filter={map.filter}
            onSelectFaction={actions.selectFaction}
          />
        </main>
        <Sidebar
          tab={map.tab}
          details={map.details}
          pinned={map.details ? map.pinned.has(map.details.island.id) : false}
          leaderboard={map.leaderboard}
          factionBoard={map.factionBoard}
          nodeBoard={map.nodeBoard}
          onTabChange={actions.setTab}
          onCloseIsland={actions.closeIsland}
          onTogglePin={actions.togglePin}
          onFocusIsland={actions.focusIsland}
          onClearPins={actions.clearPins}
        />
      </div>
    </div>
  );
}
