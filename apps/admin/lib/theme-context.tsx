'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

/**
 * To add a theme:
 *   1. Add an entry here — { id, label, swatch } where swatch is a representative hex colour.
 *   2. Add a matching [data-theme="<id>"] CSS block in app/globals.css with all CSS variables.
 * The first entry in this array is the default theme.
 */
export const THEMES = [
  { id: 'cafe-sepia', label: 'Café Sepia', swatch: '#f5f0e8' },
  { id: 'ocean', label: 'Ocean', swatch: '#151c2c' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

const STORAGE_KEY = 'lite-admin-theme';

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>('cafe-sepia');

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
      document.documentElement.setAttribute('data-theme', id);
      localStorage.setItem(STORAGE_KEY, id);
    } catch {}
  }, []);

  // Sync attribute on mount (in case hydration differs from inline script)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
