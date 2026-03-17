'use client';

import { useState, useEffect, useCallback } from 'react';
import ProtectedLayout from '@/components/protected-layout';
import { settingsApi, credentialsApi, menuApi } from '@/lib/api';
import { useDisplayPrefs } from '@/lib/display-prefs';
import { SecretField } from '@/components/ui/secret-field';
import { Toggle } from '@/components/ui/toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  WrenchScrewdriverIcon,
  CheckCircleIcon,
  ServerStackIcon,
  Bars3Icon,
  ChevronRightIcon,
  ChevronDownIcon,
  HomeIcon,
  PhotoIcon,
  EnvelopeIcon,
  PencilSquareIcon,
  UsersIcon,
  MegaphoneIcon,
  DocumentCurrencyDollarIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  GlobeAltIcon,
  AtSymbolIcon,
  UserCircleIcon,
  DocumentTextIcon,
  CogIcon,
  LockClosedIcon,
  ArrowPathIcon,
  XMarkIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { PageHeader } from '@/components/page-header';

interface Settings {
  email_enabled: boolean;
  maintenance_mode: boolean;
  maintenance_message: string;
  rate_limit_forms_max: number;
  rate_limit_forms_window_minutes: number;
}

interface StorageConfig {
  active_provider: string;
  s3_access_key_id: string;
  s3_secret_access_key: string;
  s3_bucket: string;
  s3_region: string;
}

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

const menuStructure: { group: string; items: { name: string; key: string | null; icon: IconComponent }[] }[] = [
  { group: 'Overview', items: [{ name: 'Dashboard', key: null, icon: HomeIcon }] },
  { group: 'Content', items: [{ name: 'Media', key: 'nav_visible_media', icon: PhotoIcon }] },
  { group: 'Leads', items: [
    { name: 'Contacts', key: 'nav_visible_contacts', icon: EnvelopeIcon },
    { name: 'Compose', key: 'nav_visible_compose', icon: PencilSquareIcon },
  ]},
  { group: 'Audience', items: [
    { name: 'Subscribers', key: 'nav_visible_subscribers', icon: UsersIcon },
    { name: 'Campaigns', key: 'nav_visible_campaigns', icon: MegaphoneIcon },
  ]},
  { group: 'Billing', items: [{ name: 'Invoices', key: 'nav_visible_invoices', icon: DocumentCurrencyDollarIcon }] },
  { group: 'Sites', items: [{ name: 'Sites & API Keys', key: 'nav_visible_sites', icon: GlobeAltIcon }] },
  { group: 'System', items: [
    { name: 'Statistics', key: 'nav_visible_stats', icon: ChartBarIcon },
    { name: 'Activity Log', key: 'nav_visible_logs', icon: ClipboardDocumentListIcon },
  ]},
  { group: 'Configure', items: [
    { name: 'Email', key: 'nav_visible_email', icon: AtSymbolIcon },
    { name: 'Email Templates', key: 'nav_visible_email_templates', icon: DocumentTextIcon },
    { name: 'Admin User', key: 'nav_visible_users', icon: UserCircleIcon },
    { name: 'Settings', key: null, icon: CogIcon },
  ]},
];

export default function SettingsPage() {
  const { prefs: displayPrefs, setPrefs: setDisplayPrefs } = useDisplayPrefs();
  const [settings, setSettings] = useState<Settings>({
    email_enabled: true,
    maintenance_mode: false,
    maintenance_message: 'We are currently under maintenance. Please check back soon.',
    rate_limit_forms_max: 10,
    rate_limit_forms_window_minutes: 10,
  });
  const [storage, setStorage] = useState<StorageConfig>({
    active_provider: 'local',
    s3_access_key_id: '',
    s3_secret_access_key: '',
    s3_bucket: '',
    s3_region: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingStorage, setSavingStorage] = useState(false);
  const [savedSettings, setSavedSettings] = useState(false);
  const [savedStorage, setSavedStorage] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Menu panel state
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPrefs, setMenuPrefs] = useState<Record<string, boolean>>({});
  const [menuCollapsed, setMenuCollapsed] = useState<Record<string, boolean>>({});

  const notifySidebar = () => window.dispatchEvent(new Event('menu-prefs-updated'));

  const toggleMenuItem = async (key: string) => {
    const newVal = menuPrefs[key] === false; // undefined/true → false, false → true
    setMenuPrefs(prev => ({ ...prev, [key]: newVal }));
    try { await menuApi.update({ [key]: newVal }); notifySidebar(); }
    catch { setMenuPrefs(prev => ({ ...prev, [key]: !newVal })); }
  };

  const toggleMenuGroup = async (group: typeof menuStructure[number]) => {
    const toggleable = group.items.filter(i => i.key !== null);
    if (!toggleable.length) return;
    const allVisible = toggleable.every(i => menuPrefs[i.key!] !== false);
    const newVal = !allVisible;
    const updates: Record<string, boolean> = {};
    for (const item of toggleable) updates[item.key!] = newVal;
    setMenuPrefs(prev => ({ ...prev, ...updates }));
    try { await menuApi.update(updates); notifySidebar(); }
    catch {
      const reverted: Record<string, boolean> = {};
      for (const item of toggleable) reverted[item.key!] = !newVal;
      setMenuPrefs(prev => ({ ...prev, ...reverted }));
    }
  };

  const resetMenu = async () => {
    const updates: Record<string, boolean> = {};
    for (const g of menuStructure) for (const i of g.items) if (i.key) updates[i.key] = true;
    setMenuPrefs(prev => ({ ...prev, ...updates }));
    try { await menuApi.update(updates); notifySidebar(); }
    catch { /* reload will fix */ }
  };

  const handleOpenMenu = async () => {
    if (menuOpen) { setMenuOpen(false); return; }
    try {
      const res = await menuApi.get();
      setMenuPrefs(res.data);
    } catch { /* defaults */ }
    setMenuOpen(true);
  };

  const load = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([settingsApi.get(), credentialsApi.get()]);
      setSettings(s.data);
      setStorage(c.data.storage);
    } catch {
      setActionError('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await settingsApi.update(settings);
      setSettings(res.data);
      setSavedSettings(true);
      setTimeout(() => setSavedSettings(false), 3000);
    } catch { setActionError('Failed to save settings.'); }
    finally { setSaving(false); }
  };

  const handleSaveStorage = async () => {
    setSavingStorage(true);
    try {
      await credentialsApi.update({ storage });
      setSavedStorage(true);
      setTimeout(() => setSavedStorage(false), 3000);
    } catch { setActionError('Failed to save storage config.'); }
    finally { setSavingStorage(false); }
  };

  if (loading) return (
    <ProtectedLayout><div className="py-12 text-center text-sm text-muted-foreground">Loading…</div></ProtectedLayout>
  );

  return (
    <ProtectedLayout>
      <div className="flex gap-6 items-start">
        {/* Left column */}
        <div className="max-w-2xl space-y-6">
          <PageHeader title="Settings" description="Runtime toggles and storage configuration." />
            {actionError && (
            <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {actionError}
              <button type="button" onClick={() => setActionError(null)} className="ml-4 text-red-400 hover:text-red-600">✕</button>
            </div>
          )}

          {/* Email toggle */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Email Notifications</CardTitle>
              <CardDescription>Master switch for outgoing emails. Configure provider and addresses in the Email section.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Email delivery enabled</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">When off, forms save to DB but no emails are sent.</p>
                </div>
                <Toggle checked={settings.email_enabled} onChange={v => setSettings(p => ({ ...p, email_enabled: v }))} accent="bg-blue-600" />
              </div>
            </CardContent>
          </Card>

          {/* Maintenance mode */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <WrenchScrewdriverIcon className="h-4 w-4" />
                Maintenance Mode
              </CardTitle>
              <CardDescription>Block all public form submissions with a custom message.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Enable maintenance mode</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Returns 503 on all contact + waitlist POSTs.</p>
                </div>
                <Toggle checked={settings.maintenance_mode} onChange={v => setSettings(p => ({ ...p, maintenance_mode: v }))} accent="bg-orange-500" />
              </div>
              <div>
                <Label htmlFor="maintenance_message" className="text-sm font-medium">Maintenance message</Label>
                <textarea
                  id="maintenance_message"
                  value={settings.maintenance_message}
                  onChange={e => setSettings(p => ({ ...p, maintenance_message: e.target.value }))}
                  rows={3}
                  className="mt-1.5 w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {settings.maintenance_mode && (
                <div className="rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                  Maintenance mode is <strong>active</strong>. Public forms are blocked.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rate Limiting */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheckIcon className="h-4 w-4" />
                Rate Limiting
              </CardTitle>
              <CardDescription>Control how many form submissions a single IP can make. Protects against bot spam.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Max submissions per IP</Label>
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    className="mt-1.5 w-full"
                    value={settings.rate_limit_forms_max}
                    onChange={e => setSettings(p => ({ ...p, rate_limit_forms_max: Math.max(1, parseInt(e.target.value) || 10) }))}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Window (minutes)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={1440}
                    className="mt-1.5 w-full"
                    value={settings.rate_limit_forms_window_minutes}
                    onChange={e => setSettings(p => ({ ...p, rate_limit_forms_window_minutes: Math.max(1, parseInt(e.target.value) || 10) }))}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Currently: <strong>{settings.rate_limit_forms_max}</strong> submissions per <strong>{settings.rate_limit_forms_window_minutes}</strong> minute{settings.rate_limit_forms_window_minutes !== 1 ? 's' : ''} per IP. Changes take effect immediately after saving.
              </p>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Saving…' : 'Save Settings'}
            </Button>
            {savedSettings && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                <CheckCircleIcon className="h-4 w-4" />Saved
              </span>
            )}
          </div>

          {/* Menu Configuration toggle */}
          <button type="button" onClick={() => void handleOpenMenu()} className="block w-full text-left">
            <Card className={`transition-colors hover:border-border ${menuOpen ? 'border-blue-200 bg-blue-50/30' : ''}`}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <Bars3Icon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Configure Menu</p>
                    <p className="text-xs text-muted-foreground">Show or hide sidebar navigation items</p>
                  </div>
                </div>
                <ChevronRightIcon className={`h-4 w-4 text-muted-foreground transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
              </CardContent>
            </Card>
          </button>

          {/* Media Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PhotoIcon className="h-4 w-4" />
                Media
              </CardTitle>
              <CardDescription>
                Configure media paths and upload limits. Changes are saved automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Copy Path Base URL</Label>
                <Input
                  className="mt-1.5 font-mono text-sm"
                  value={displayPrefs.mediaBasePath}
                  onChange={e => setDisplayPrefs({ mediaBasePath: e.target.value })}
                  placeholder="https://cdn.example.com/media"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Copied path will be: <code className="rounded bg-accent px-1">{displayPrefs.mediaBasePath || '/uploads/portfolio'}/filename.webp</code>
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium">Max Upload Size (MB)</Label>
                <Input
                  className="mt-1.5 w-32"
                  type="number"
                  min={1}
                  max={500}
                  value={displayPrefs.maxUploadSizeMB}
                  onChange={e => setDisplayPrefs({ maxUploadSizeMB: Math.max(1, parseInt(e.target.value) || 10) })}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Ensure your server and reverse proxy (e.g. nginx <code className="rounded bg-accent px-1">client_max_body_size</code>) allow at least this size.
                  Backend default is 10 MB via <code className="rounded bg-accent px-1">MAX_FILE_SIZE</code> env var.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Storage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ServerStackIcon className="h-4 w-4" />
                Storage
              </CardTitle>
              <CardDescription>
                Active provider: <strong>{storage.active_provider}</strong>.
                S3 credentials are only required when using the S3 provider.
                Storage changes require a server restart.
              </CardDescription>
            </CardHeader>
            {storage.active_provider === 's3' && (
              <CardContent className="space-y-4">
                <SecretField label="Access Key ID" value={storage.s3_access_key_id}
                  onChange={v => setStorage(p => ({ ...p, s3_access_key_id: v }))} />
                <SecretField label="Secret Access Key" value={storage.s3_secret_access_key}
                  onChange={v => setStorage(p => ({ ...p, s3_secret_access_key: v }))} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-medium">Bucket</Label>
                    <Input className="mt-1.5" value={storage.s3_bucket}
                      onChange={e => setStorage(p => ({ ...p, s3_bucket: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Region</Label>
                    <Input className="mt-1.5" value={storage.s3_region}
                      onChange={e => setStorage(p => ({ ...p, s3_region: e.target.value }))} />
                  </div>
                </div>
                <p className="text-xs text-amber-600 bg-amber-50 rounded px-3 py-2 border border-amber-200">
                  Storage changes require a server restart to take effect.
                </p>
                <div className="flex items-center gap-3">
                  <Button onClick={() => void handleSaveStorage()} disabled={savingStorage}>
                    {savingStorage ? 'Saving…' : 'Save Storage Config'}
                  </Button>
                  {savedStorage && (
                    <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                      <CheckCircleIcon className="h-4 w-4" />Saved
                    </span>
                  )}
                </div>
              </CardContent>
            )}
            {storage.active_provider === 'local' && (
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Using local filesystem storage. Files are saved to <code className="rounded bg-accent px-1 text-xs">src/public/uploads/</code>.
                  Switch to S3 via the <code className="rounded bg-accent px-1 text-xs">STORAGE_PROVIDER=s3</code> env var.
                </p>
              </CardContent>
            )}
          </Card>
        </div>

        {/* Right side — Menu config panel (opens/closes in the empty space) */}
        {menuOpen && (
          <div className="hidden lg:block max-w-2xl flex-1 sticky top-8">
            {/* Header — aligned with the settings cards below the page title */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Bars3Icon className="h-6 w-6 text-muted-foreground" />
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Configure Menu</h2>
                  <p className="text-sm text-muted-foreground">Show or hide sidebar navigation items</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => void resetMenu()}
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  Reset to defaults
                </Button>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-muted-foreground hover:bg-accent transition-colors"
                  title="Close"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {menuStructure.map((group) => {
                const toggleable = group.items.filter(i => i.key !== null);
                const visibleCount = toggleable.filter(i => menuPrefs[i.key!] !== false).length + group.items.filter(i => i.key === null).length;
                const isCollapsed = menuCollapsed[group.group];
                const allVisible = toggleable.length === 0 || toggleable.every(i => menuPrefs[i.key!] !== false);
                const hasToggleable = toggleable.length > 0;

                return (
                  <Card key={group.group}>
                    <CardHeader
                      className="cursor-pointer select-none py-3 px-4"
                      onClick={() => setMenuCollapsed(prev => ({ ...prev, [group.group]: !prev[group.group] }))}
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
                            {visibleCount}/{group.items.length} visible
                          </span>
                        </div>
                        {hasToggleable && (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={allVisible}
                            onClick={(e) => { e.stopPropagation(); void toggleMenuGroup(group); }}
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
                            const visible = locked || menuPrefs[item.key!] !== false;
                            return (
                              <li key={item.name} className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-accent">
                                <div className="flex items-center gap-2.5">
                                  <item.icon className={`h-4 w-4 ${visible ? 'text-muted-foreground' : 'text-muted-foreground/50'}`} />
                                  <span className={`text-sm ${visible ? 'text-foreground' : 'text-muted-foreground'}`}>{item.name}</span>
                                  {locked && <LockClosedIcon className="h-3 w-3 text-muted-foreground/50" />}
                                </div>
                                <input
                                  type="checkbox"
                                  checked={visible}
                                  disabled={locked}
                                  onChange={() => !locked && toggleMenuItem(item.key!)}
                                  className={`h-4 w-4 rounded border-border text-blue-600 ${locked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} focus:ring-blue-500`}
                                />
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

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Dashboard and Settings are always visible and cannot be hidden.
            </p>
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
