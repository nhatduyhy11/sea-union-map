import { create } from "zustand";

export type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";
const STORAGE_KEY = "sea-union-theme";
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function resolveTheme(preference: ThemePreference): Theme {
  return preference === "system"
    ? systemTheme.matches
      ? "dark"
      : "light"
    : preference;
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#141e27" : "#eef1f3");
}

interface ThemeState {
  preference: ThemePreference;
  theme: Theme;
  setPreference: (preference: ThemePreference) => void;
}

const initialPreference = readPreference();
const initialTheme = resolveTheme(initialPreference);
applyTheme(initialTheme);

export const useTheme = create<ThemeState>()((set) => ({
  preference: initialPreference,
  theme: initialTheme,
  setPreference: (preference) => {
    const theme = resolveTheme(preference);
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Theme switching still works when browser storage is unavailable.
    }
    set({ preference, theme });
  },
}));

function syncSystemTheme() {
  if (useTheme.getState().preference !== "system") return;
  const theme = resolveTheme("system");
  applyTheme(theme);
  useTheme.setState({ theme });
}

systemTheme.addEventListener("change", syncSystemTheme);
import.meta.hot?.dispose(() => {
  systemTheme.removeEventListener("change", syncSystemTheme);
});
