'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { Button } from './ui/button';
import {
  HomeIcon,
  PhotoIcon,
  EnvelopeIcon,
  UsersIcon,
  ChartBarIcon,
  ArrowRightOnRectangleIcon,
  CogIcon,
  ClipboardDocumentListIcon,
  GlobeAltIcon,
  AtSymbolIcon,
  UserCircleIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

interface ProtectedLayoutProps {
  children: React.ReactNode;
}

const navigation = [
  {
    group: 'Overview',
    items: [
      { name: 'Dashboard', href: '/', icon: HomeIcon },
    ],
  },
  {
    group: 'Content',
    items: [
      { name: 'Media', href: '/media', icon: PhotoIcon },
    ],
  },
  {
    group: 'Leads',
    items: [
      { name: 'Contacts', href: '/contacts', icon: EnvelopeIcon },
      { name: 'Waitlist', href: '/waitlist', icon: UsersIcon },
    ],
  },
  {
    group: 'Sites',
    items: [
      { name: 'Sites & API Keys', href: '/sites', icon: GlobeAltIcon },
    ],
  },
  {
    group: 'System',
    items: [
      { name: 'Statistics', href: '/stats', icon: ChartBarIcon },
      { name: 'Activity Log', href: '/logs', icon: ClipboardDocumentListIcon },
    ],
  },
  {
    group: 'Configure',
    items: [
      { name: 'Email', href: '/email', icon: AtSymbolIcon },
      { name: 'Email Templates', href: '/email/templates', icon: DocumentTextIcon },
      { name: 'Admin User', href: '/users', icon: UserCircleIcon },
      { name: 'Settings', href: '/settings', icon: CogIcon },
    ],
  },
];

export default function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const isActive = (href: string) => pathname === href;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-white border-r border-gray-100 shadow-sm">
        {/* Logo */}
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-gray-100 px-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/crown-logo.png" alt="Lite Admin" width={36} height={36} className="shrink-0" />
          <span className="text-base font-semibold text-gray-900 tracking-tight">Lite Admin</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {navigation.map((section) => (
            <div key={section.group}>
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
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
                            ? 'bg-gray-900 text-white'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                      >
                        <item.icon className={`h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-gray-400'}`} />
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
        <div className="shrink-0 border-t border-gray-100 p-3">
          <div className="mb-2 flex items-center gap-2 px-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white shrink-0">
              {user.email.charAt(0).toUpperCase()}
            </div>
            <p className="truncate text-xs text-gray-500">{user.email}</p>
          </div>
          <Button
            onClick={logout}
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-gray-500 hover:text-red-600 hover:bg-red-50"
          >
            <ArrowRightOnRectangleIcon className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="pl-60">
        <main className="min-h-screen p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
