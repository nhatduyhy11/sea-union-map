import { create } from "zustand";
export type Theme = "light" | "dark";
const STORAGE_KEY = "sea-union-theme";
function readTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#141e27" : "#eef1f3");
}
interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
}
const initialTheme = readTheme();
applyTheme(initialTheme);
export const useTheme = create<ThemeState>()((set) => ({
  theme: initialTheme,
  toggleTheme: () =>
    set((state) => {
      const theme = state.theme === "light" ? "dark" : "light";
      applyTheme(theme);
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        /* Theme switching still works when browser storage is unavailable. */
      }
      return { theme };
    }),
}));
