'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { menuApi, isDemoMode } from '@/lib/api';
import Link from 'next/link';
import { Button } from './ui/button';
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { ThemeSelector } from './theme-selector';
import { navigation } from '@/lib/nav-config';

interface ProtectedLayoutProps {
  children: React.ReactNode;
}


export default function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuPrefs, setMenuPrefs] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const fetchMenuPrefs = useCallback(async () => {
    try {
      const res = await menuApi.get();
      setMenuPrefs(res.data);
    } catch {
      // fallback: show all items
      setMenuPrefs({});
    }
  }, []);

  useEffect(() => {
    if (user) void fetchMenuPrefs();
  }, [user, fetchMenuPrefs]);

  // Listen for menu preference changes (from the settings/menu page)
  useEffect(() => {
    const handler = () => fetchMenuPrefs();
    window.addEventListener('menu-prefs-updated', handler);
    return () => window.removeEventListener('menu-prefs-updated', handler);
  }, [fetchMenuPrefs]);

  const filteredNavigation = useMemo(() => {
    if (!menuPrefs) return navigation; // show all while loading
    return navigation
      .map(section => ({
        ...section,
        items: section.items.filter(item =>
          item.navKey === null || menuPrefs[item.navKey] !== false
        ),
      }))
      .filter(section => section.items.length > 0);
  }, [menuPrefs]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const isActive = (href: string) => {
    if (href.includes('?')) {
      const [path, query] = href.split('?');
      return pathname === path && typeof window !== 'undefined' && window.location.search.includes(query);
    }
    return pathname === href;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Demo Banner */}
      {isDemoMode && (
        <div className="fixed top-0 left-0 right-0 z-[60] flex h-8 items-center justify-center bg-indigo-600 text-xs font-medium text-white">
          Demo Mode — data is simulated
        </div>
      )}
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-sidebar border-r border-sidebar-border shadow-sm ${isDemoMode ? 'top-8' : ''}`}>
        {/* Logo */}
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/crown-logo.png" alt="Lite Admin" width={36} height={36} className="shrink-0" />
          <span className="text-base font-semibold text-foreground tracking-tight">Lite Admin</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {filteredNavigation.map((section) => (
            <div key={section.group}>
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted">
                {section.group}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
                          active
                            ? 'bg-sidebar-active text-sidebar-active-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        }`}
                      >
                        <item.icon className={`h-4 w-4 shrink-0 ${active ? 'text-sidebar-active-foreground' : 'text-sidebar-muted'}`} />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-sidebar-border p-3">
          <div className="mb-2 flex items-center gap-2 px-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sidebar-active text-xs font-semibold text-sidebar-active-foreground shrink-0">
              {user.email.charAt(0).toUpperCase()}
            </div>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
          <ThemeSelector />
          <Button
            onClick={logout}
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-start gap-2 text-muted-foreground hover:text-red-600 hover:bg-red-50"
          >
            <ArrowRightOnRectangleIcon className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className={`pl-60 ${isDemoMode ? 'pt-8' : ''}`}>
        <main className="min-h-screen p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
