'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export const THEMES = [
  { id: 'default', label: 'Default', swatch: '#ffffff' },
  { id: 'midnight-gold', label: 'Midnight Gold', swatch: '#18181a' },
  { id: 'warm-cream', label: 'Warm Cream', swatch: '#f7f7f5' },
  { id: 'ocean', label: 'Ocean', swatch: '#151c2c' },
  { id: 'forest', label: 'Forest', swatch: '#141e17' },
  { id: 'cafe-sepia', label: 'Café Sepia', swatch: '#f5f0e8' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

const STORAGE_KEY = 'lite-admin-theme';

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>('default');

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
      if (id === 'default') {
        document.documentElement.removeAttribute('data-theme');
        localStorage.removeItem(STORAGE_KEY);
      } else {
        document.documentElement.setAttribute('data-theme', id);
        localStorage.setItem(STORAGE_KEY, id);
      }
    } catch {}
  }, []);

  // Sync attribute on mount (in case hydration differs from inline script)
  useEffect(() => {
    if (theme === 'default') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
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
