import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";
export type ThemeColor = "red" | "blue" | "green" | "violet" | "orange";

const STORAGE_KEY = "portal_theme";
const COLOR_STORAGE_KEY = "portal_theme_color";
const THEME_COLORS: ThemeColor[] = ["red", "blue", "green", "violet", "orange"];

type ThemeContextType = {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  themeColor: ThemeColor;
  setTheme: (theme: ThemePreference) => void;
  setThemeColor: (color: ThemeColor) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function readStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

function readStoredThemeColor(): ThemeColor {
  if (typeof window === "undefined") return "red";
  const stored = localStorage.getItem(COLOR_STORAGE_KEY);
  return THEME_COLORS.includes(stored as ThemeColor) ? (stored as ThemeColor) : "red";
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? getSystemTheme() : preference;
}

function applyThemeClass(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

function applyThemeColor(color: ThemeColor) {
  document.documentElement.dataset.themeColor = color;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() => readStoredTheme());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(readStoredTheme()),
  );
  const [themeColor, setThemeColorState] = useState<ThemeColor>(() =>
    readStoredThemeColor(),
  );

  const setTheme = useCallback((next: ThemePreference) => {
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
    const resolved = resolveTheme(next);
    setResolvedTheme(resolved);
    applyThemeClass(resolved);
  }, []);

  const setThemeColor = useCallback((next: ThemeColor) => {
    localStorage.setItem(COLOR_STORAGE_KEY, next);
    setThemeColorState(next);
    applyThemeColor(next);
  }, []);

  const toggleTheme = useCallback(() => {
    const order: ThemePreference[] = ["light", "dark", "system"];
    const currentIndex = order.indexOf(theme);
    setTheme(order[(currentIndex + 1) % order.length]);
  }, [setTheme, theme]);

  useEffect(() => {
    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    applyThemeClass(resolved);

    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = getSystemTheme();
      setResolvedTheme(next);
      applyThemeClass(next);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  useEffect(() => {
    applyThemeColor(themeColor);
  }, [themeColor]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, themeColor, setTheme, setThemeColor, toggleTheme }),
    [theme, resolvedTheme, themeColor, setTheme, setThemeColor, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
