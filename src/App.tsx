import { AppHeader } from "./components/layout/AppHeader";
import { AppFooter } from "./components/layout/AppFooter";
import { NavigationRail } from "./components/layout/NavigationRail";
import { MapHeading } from "./components/map/MapHeading";
import { MapToolbar } from "./components/map/MapToolbar";
import { MapCanvas } from "./components/map/MapCanvas";
import { FactionLegend } from "./components/map/FactionLegend";
import { Sidebar } from "./components/panels/Sidebar";
import styles from "./App.module.css";

// Thuần layout — component nào cần state/command của map tự subscribe store
// (src/stores) hoặc hook derived (src/hooks), nên App không threaded props.
export function App() {
  return (
    <div className={styles.app}>
      <AppHeader />
      <div className={styles.workspace}>
        <NavigationRail />
        <main className={styles.mainContent}>
          <MapHeading />
          <MapToolbar />
          <MapCanvas />
          <FactionLegend />
        </main>
        <Sidebar />
      </div>
      <AppFooter />
    </div>
  );
}
