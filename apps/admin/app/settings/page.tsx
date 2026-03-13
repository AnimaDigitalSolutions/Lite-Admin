'use client';

import { useState, useEffect, useCallback } from 'react';
import ProtectedLayout from '@/components/protected-layout';
import { settingsApi, credentialsApi } from '@/lib/api';
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
} from '@heroicons/react/24/outline';
import Link from 'next/link';

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

export default function SettingsPage() {
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

        {/* Menu Configuration link */}
        <Link href="/settings/menu" className="block">
          <Card className="transition-colors hover:border-gray-300">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <Bars3Icon className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Configure Menu</p>
                  <p className="text-xs text-gray-500">Show or hide sidebar navigation items</p>
                </div>
              </div>
              <ChevronRightIcon className="h-4 w-4 text-gray-400" />
            </CardContent>
          </Card>
        </Link>

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
    </ProtectedLayout>
  );
}
