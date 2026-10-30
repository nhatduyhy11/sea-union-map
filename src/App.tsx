import { AppHeader } from "./components/layout/AppHeader";
import { AppFooter } from "./components/layout/AppFooter";
import { NavigationRail } from "./components/layout/NavigationRail";
import { MapHeader } from "./components/map/map-header";
import { MapCanvas } from "./components/map/MapCanvas";
import { MapFooter } from "./components/map/map-footer";
import { Sidebar } from "./components/panels/Sidebar";
import { ToastHost } from "./components/shared/ToastHost";
import { useSourceClockSync } from "./hooks/useSourceClockSync";
import styles from "./App.module.css";

// Thuần layout — component nào cần state/command của map tự subscribe store
// (src/stores) hoặc hook derived (src/hooks), nên App không threaded props.
// Ngoại lệ: useSourceClockSync là lệnh global (nguồn data theo giờ), không
// thuộc layout cụ thể nào.
export function App() {
  useSourceClockSync();
  return (
    <div className={styles.app}>
      <AppHeader />
      <div className={styles.workspace}>
        <NavigationRail />
        <main className={styles.mainContent}>
          <MapHeader />
          <MapCanvas />
          <MapFooter />
        </main>
        <Sidebar />
      </div>
      <AppFooter />
      <ToastHost />
    </div>
  );
}
