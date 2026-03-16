'use client';

import { useState, useEffect, useCallback } from 'react';
import ProtectedLayout from '@/components/protected-layout';
import { menuApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  HomeIcon,
  PhotoIcon,
  EnvelopeIcon,
  UsersIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  GlobeAltIcon,
  AtSymbolIcon,
  UserCircleIcon,
  DocumentTextIcon,
  CogIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  LockClosedIcon,
  PencilSquareIcon,
  MegaphoneIcon,
  DocumentCurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import { PageHeader } from '@/components/page-header';

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

interface NavItem {
  name: string;
  key: string | null; // null = locked
  icon: IconComponent;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

const menuStructure: NavGroup[] = [
  {
    group: 'Overview',
    items: [
      { name: 'Dashboard', key: null, icon: HomeIcon },
    ],
  },
  {
    group: 'Content',
    items: [
      { name: 'Media', key: 'nav_visible_media', icon: PhotoIcon },
    ],
  },
  {
    group: 'Leads',
    items: [
      { name: 'Contacts', key: 'nav_visible_contacts', icon: EnvelopeIcon },
      { name: 'Compose', key: 'nav_visible_compose', icon: PencilSquareIcon },
    ],
  },
  {
    group: 'Audience',
    items: [
      { name: 'Subscribers', key: 'nav_visible_subscribers', icon: UsersIcon },
      { name: 'Campaigns', key: 'nav_visible_campaigns', icon: MegaphoneIcon },
    ],
  },
  {
    group: 'Billing',
    items: [
      { name: 'Invoices', key: 'nav_visible_invoices', icon: DocumentCurrencyDollarIcon },
    ],
  },
  {
    group: 'Sites',
    items: [
      { name: 'Sites & API Keys', key: 'nav_visible_sites', icon: GlobeAltIcon },
    ],
  },
  {
    group: 'System',
    items: [
      { name: 'Statistics', key: 'nav_visible_stats', icon: ChartBarIcon },
      { name: 'Activity Log', key: 'nav_visible_logs', icon: ClipboardDocumentListIcon },
    ],
  },
  {
    group: 'Configure',
    items: [
      { name: 'Email', key: 'nav_visible_email', icon: AtSymbolIcon },
      { name: 'Email Templates', key: 'nav_visible_email_templates', icon: DocumentTextIcon },
      { name: 'Admin User', key: 'nav_visible_users', icon: UserCircleIcon },
      { name: 'Settings', key: null, icon: CogIcon },
    ],
  },
];

export default function MenuConfigPage() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const fetchPrefs = useCallback(async () => {
    try {
      const res = await menuApi.get();
      setPrefs(res.data);
    } catch {
      // fallback: all visible
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchPrefs(); }, [fetchPrefs]);

  const notifySidebar = () => {
    window.dispatchEvent(new Event('menu-prefs-updated'));
  };

  const toggleItem = async (key: string) => {
    const newVal = !prefs[key];
    setPrefs(prev => ({ ...prev, [key]: newVal }));
    try {
      await menuApi.update({ [key]: newVal });
      notifySidebar();
    } catch {
      // revert on failure
      setPrefs(prev => ({ ...prev, [key]: !newVal }));
    }
  };

  const toggleGroup = async (group: NavGroup) => {
    const toggleable = group.items.filter(i => i.key !== null);
    if (toggleable.length === 0) return;

    const allVisible = toggleable.every(i => prefs[i.key!] !== false);
    const newVal = !allVisible;

    const updates: Record<string, boolean> = {};
    for (const item of toggleable) {
      updates[item.key!] = newVal;
    }

    setPrefs(prev => ({ ...prev, ...updates }));
    try {
      await menuApi.update(updates);
      notifySidebar();
    } catch {
      // revert
      const reverted: Record<string, boolean> = {};
      for (const item of toggleable) {
        reverted[item.key!] = !newVal;
      }
      setPrefs(prev => ({ ...prev, ...reverted }));
    }
  };

  const resetAll = async () => {
    const updates: Record<string, boolean> = {};
    for (const group of menuStructure) {
      for (const item of group.items) {
        if (item.key) updates[item.key] = true;
      }
    }
    setPrefs(prev => ({ ...prev, ...updates }));
    try {
      await menuApi.update(updates);
      notifySidebar();
    } catch {
      void fetchPrefs();
    }
  };

  const toggleCollapse = (group: string) => {
    setCollapsed(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const getGroupStats = (group: NavGroup) => {
    const toggleable = group.items.filter(i => i.key !== null);
    const visible = toggleable.filter(i => prefs[i.key!] !== false).length;
    const locked = group.items.filter(i => i.key === null).length;
    return { visible: visible + locked, total: group.items.length };
  };

  const isGroupAllVisible = (group: NavGroup) => {
    const toggleable = group.items.filter(i => i.key !== null);
    return toggleable.length === 0 || toggleable.every(i => prefs[i.key!] !== false);
  };

  return (
    <ProtectedLayout>
      <div className="max-w-2xl mx-auto">
        <PageHeader title="Configure Menu" description="Show or hide sidebar navigation items">
          <Button
            onClick={resetAll}
            variant="outline"
            size="sm"
            className="gap-1.5"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Reset to defaults
          </Button>
        </PageHeader>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {menuStructure.map((group) => {
              const stats = getGroupStats(group);
              const isCollapsed = collapsed[group.group];
              const allVisible = isGroupAllVisible(group);
              const hasToggleable = group.items.some(i => i.key !== null);

              return (
                <Card key={group.group}>
                  <CardHeader
                    className="cursor-pointer select-none py-3 px-4"
                    onClick={() => toggleCollapse(group.group)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isCollapsed ? (
                          <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
                        )}
                        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                          {group.group}
                        </CardTitle>
                        <span className="text-xs text-muted-foreground">
                          {stats.visible}/{stats.total} visible
                        </span>
                      </div>
                      {hasToggleable && (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={allVisible}
                          onClick={(e) => {
                            e.stopPropagation();
                            void toggleGroup(group);
                          }}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                            allVisible ? 'bg-blue-600' : 'bg-muted'
                          }`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            allVisible ? 'translate-x-[18px]' : 'translate-x-[3px]'
                          }`} />
                        </button>
                      )}
                    </div>
                  </CardHeader>
                  {!isCollapsed && (
                    <CardContent className="pt-0 pb-3 px-4">
                      <ul className="space-y-1">
                        {group.items.map((item) => {
                          const locked = item.key === null;
                          const visible = locked || prefs[item.key!] !== false;

                          return (
                            <li
                              key={item.name}
                              className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-accent"
                            >
                              <div className="flex items-center gap-2.5">
                                <item.icon className={`h-4 w-4 ${visible ? 'text-muted-foreground' : 'text-muted-foreground/50'}`} />
                                <span className={`text-sm ${visible ? 'text-foreground' : 'text-muted-foreground'}`}>
                                  {item.name}
                                </span>
                                {locked && (
                                  <LockClosedIcon className="h-3 w-3 text-muted-foreground/50" />
                                )}
                              </div>
                              {locked ? (
                                <input
                                  type="checkbox"
                                  checked
                                  disabled
                                  className="h-4 w-4 rounded border-border text-blue-600 cursor-not-allowed opacity-50"
                                />
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={visible}
                                  onChange={() => toggleItem(item.key!)}
                                  className="h-4 w-4 rounded border-border text-blue-600 cursor-pointer focus:ring-blue-500"
                                />
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Dashboard and Settings are always visible and cannot be hidden.
        </p>
      </div>
    </ProtectedLayout>
  );
}
