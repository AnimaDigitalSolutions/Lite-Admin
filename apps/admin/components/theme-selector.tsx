'use client';

import { THEMES, useTheme } from '@/lib/theme-context';

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-1.5 px-2">
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          title={t.label}
          onClick={() => setTheme(t.id)}
          className={`h-5 w-5 rounded-full border transition-shadow ${
            theme === t.id
              ? 'ring-2 ring-offset-1 ring-sidebar-active'
              : 'border-sidebar-border hover:scale-110'
          }`}
          style={{ backgroundColor: t.swatch }}
        />
      ))}
    </div>
  );
}
