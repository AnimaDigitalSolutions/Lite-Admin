"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

/**
 * To add a theme:
 *   1. Add an entry here: { id, label, swatch, scheme } where swatch is a representative hex colour
 *      and scheme is "light" or "dark" (drives native controls via color-scheme).
 *   2. Add a matching [data-theme="<id>"] CSS block in app/globals.css with all CSS variables.
 * The first entry in this array is the default theme.
 */
export const THEMES = [
  { id: "cafe-sepia", label: "Café Sepia", swatch: "#f5f0e8", scheme: "light" },
  { id: "ocean", label: "Ocean", swatch: "#151c2c", scheme: "dark" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const STORAGE_KEY = "lite-admin-theme";

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("cafe-sepia");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
      if (stored && THEMES.some((t) => t.id === stored)) {
        setThemeState(stored);
      }
    } catch {}
  }, []);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeState(id);
    try {
      document.documentElement.setAttribute("data-theme", id);
      localStorage.setItem(STORAGE_KEY, id);
    } catch {}
  }, []);

  // Sync attribute on mount (in case hydration differs from inline script)
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    // Match native controls and the mobile browser bar to the theme
    root.style.colorScheme =
      THEMES.find((t) => t.id === theme)?.scheme ?? "light";
    const bar = getComputedStyle(root).getPropertyValue("--sidebar-bg").trim();
    let meta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = `hsl(${bar})`;
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
