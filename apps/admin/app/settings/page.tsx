'use client';

import { useState, useEffect, useCallback } from 'react';
import ProtectedLayout from '@/components/protected-layout';
import { settingsApi, credentialsApi, menuApi } from '@/lib/api';
import { useDisplayPrefs } from '@/lib/display-prefs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  WrenchScrewdriverIcon,
  CheckCircleIcon,
  ServerStackIcon,
  EyeIcon,
  EyeSlashIcon,
  ClipboardDocumentIcon,
  Bars3Icon,
  ChevronRightIcon,
  ChevronDownIcon,
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
  LockClosedIcon,
  ArrowPathIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface Settings {
  email_enabled: boolean;
  maintenance_mode: boolean;
  maintenance_message: string;
}

interface StorageConfig {
  active_provider: string;
  s3_access_key_id: string;
  s3_secret_access_key: string;
  s3_bucket: string;
  s3_region: string;
}

function Toggle({ checked, onChange, accent = 'blue' }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  accent?: 'blue' | 'orange';
}) {
  const active = accent === 'orange' ? 'bg-orange-500' : 'bg-blue-600';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${checked ? active : 'bg-gray-200'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function SecretField({ value, onChange, label, placeholder }: {
  value: string; onChange: (v: string) => void; label: string; placeholder?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div>
      <Label className="text-sm font-medium">{label}</Label>
      <div className="mt-1.5 flex gap-1.5">
        <Input type={revealed ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder ?? '••••••••'} className="font-mono text-sm" />
        <button type="button" onClick={() => setRevealed(r => !r)} className="rounded border px-2 text-gray-500 hover:bg-gray-50" title={revealed ? 'Hide' : 'Reveal'}>
          {revealed ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
        </button>
        <button type="button" onClick={() => void copy()} className="rounded border px-2 text-gray-500 hover:bg-gray-50" title="Copy">
          <ClipboardDocumentIcon className={`h-4 w-4 ${copied ? 'text-emerald-600' : ''}`} />
        </button>
      </div>
    </div>
  );
}

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

const menuStructure: { group: string; items: { name: string; key: string | null; icon: IconComponent }[] }[] = [
  { group: 'Overview', items: [{ name: 'Dashboard', key: null, icon: HomeIcon }] },
  { group: 'Content', items: [{ name: 'Media', key: 'nav_visible_media', icon: PhotoIcon }] },
  { group: 'Leads', items: [
    { name: 'Contacts', key: 'nav_visible_contacts', icon: EnvelopeIcon },
    { name: 'Waitlist', key: 'nav_visible_waitlist', icon: UsersIcon },
  ]},
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
  const [savedMediaPath, setSavedMediaPath] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    email_enabled: true,
    maintenance_mode: false,
    maintenance_message: 'We are currently under maintenance. Please check back soon.',
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
    const newVal = !menuPrefs[key];
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
    <ProtectedLayout><div className="py-12 text-center text-sm text-gray-400">Loading…</div></ProtectedLayout>
  );

  return (
    <ProtectedLayout>
      <div className="flex gap-6 items-start">
        {/* Left column */}
        <div className="max-w-2xl space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="mt-1 text-sm text-gray-500">Runtime toggles and storage configuration.</p>
          </div>
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
                  <p className="text-xs text-gray-500 mt-0.5">When off, forms save to DB but no emails are sent.</p>
                </div>
                <Toggle checked={settings.email_enabled} onChange={v => setSettings(p => ({ ...p, email_enabled: v }))} />
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
                  <p className="text-xs text-gray-500 mt-0.5">Returns 503 on all contact + waitlist POSTs.</p>
                </div>
                <Toggle checked={settings.maintenance_mode} onChange={v => setSettings(p => ({ ...p, maintenance_mode: v }))} accent="orange" />
              </div>
              <div>
                <Label htmlFor="maintenance_message" className="text-sm font-medium">Maintenance message</Label>
                <textarea
                  id="maintenance_message"
                  value={settings.maintenance_message}
                  onChange={e => setSettings(p => ({ ...p, maintenance_message: e.target.value }))}
                  rows={3}
                  className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {settings.maintenance_mode && (
                <div className="rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                  Maintenance mode is <strong>active</strong>. Public forms are blocked.
                </div>
              )}
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
            <Card className={`transition-colors hover:border-gray-300 ${menuOpen ? 'border-blue-200 bg-blue-50/30' : ''}`}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <Bars3Icon className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Configure Menu</p>
                    <p className="text-xs text-gray-500">Show or hide sidebar navigation items</p>
                  </div>
                </div>
                <ChevronRightIcon className={`h-4 w-4 text-gray-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
              </CardContent>
            </Card>
          </button>

          {/* Media Copy Path */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PhotoIcon className="h-4 w-4" />
                Media Path
              </CardTitle>
              <CardDescription>
                Base path used when copying media URLs. Set this to your hosting domain or CDN path.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Base Path</Label>
                <Input
                  className="mt-1.5 font-mono text-sm"
                  value={displayPrefs.mediaBasePath}
                  onChange={e => setDisplayPrefs({ mediaBasePath: e.target.value })}
                  placeholder="https://cdn.example.com/media"
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  Copied path will be: <code className="rounded bg-gray-100 px-1">{displayPrefs.mediaBasePath || '/uploads/portfolio'}/filename.webp</code>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  onClick={() => { setSavedMediaPath(true); setTimeout(() => setSavedMediaPath(false), 2000); }}
                >
                  {savedMediaPath ? 'Saved!' : 'Save'}
                </Button>
                {savedMediaPath && (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                    <CheckCircleIcon className="h-4 w-4" />Saved to browser
                  </span>
                )}
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
                <p className="text-sm text-gray-500">
                  Using local filesystem storage. Files are saved to <code className="rounded bg-gray-100 px-1 text-xs">src/public/uploads/</code>.
                  Switch to S3 via the <code className="rounded bg-gray-100 px-1 text-xs">STORAGE_PROVIDER=s3</code> env var.
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
                <Bars3Icon className="h-6 w-6 text-gray-400" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Configure Menu</h2>
                  <p className="text-sm text-gray-500">Show or hide sidebar navigation items</p>
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
                  className="rounded-md p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
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
                            <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                          )}
                          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-gray-600">
                            {group.group}
                          </CardTitle>
                          <span className="text-xs text-gray-400">
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
                              allVisible ? 'bg-blue-600' : 'bg-gray-200'
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
                              <li key={item.name} className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-gray-50">
                                <div className="flex items-center gap-2.5">
                                  <item.icon className={`h-4 w-4 ${visible ? 'text-gray-600' : 'text-gray-300'}`} />
                                  <span className={`text-sm ${visible ? 'text-gray-900' : 'text-gray-400'}`}>{item.name}</span>
                                  {locked && <LockClosedIcon className="h-3 w-3 text-gray-300" />}
                                </div>
                                <input
                                  type="checkbox"
                                  checked={visible}
                                  disabled={locked}
                                  onChange={() => !locked && toggleMenuItem(item.key!)}
                                  className={`h-4 w-4 rounded border-gray-300 text-blue-600 ${locked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} focus:ring-blue-500`}
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

            <p className="mt-4 text-center text-xs text-gray-400">
              Dashboard and Settings are always visible and cannot be hidden.
            </p>
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
