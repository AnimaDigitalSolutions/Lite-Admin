'use client';

import { useState, useEffect } from 'react';
import ProtectedLayout from '@/components/protected-layout';
import { usersApi, settingsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useCopyToClipboard } from '@/lib/hooks/use-copy-to-clipboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { truncateEmail } from '@/lib/utils';
import {
  UserCircleIcon,
  KeyIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  ClipboardDocumentIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import { TIMEZONE_OPTIONS, invalidateTimezoneCache } from '@/lib/timezone';
import { useDisplayPrefs } from '@/lib/display-prefs';
import { PageHeader } from '@/components/page-header';

export default function UsersPage() {
  const { user } = useAuth();
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { copy: copyToClipboard, isCopied } = useCopyToClipboard();

  // Timezone settings
  const [timezone, setTimezone] = useState('UTC');

  // Display preferences
  const { prefs, setPrefs } = useDisplayPrefs();
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [tzSaving, setTzSaving] = useState(false);
  const [tzSuccess, setTzSuccess] = useState(false);

  useEffect(() => {
    void settingsApi.get().then((res) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const tz = (res.data?.display_timezone as string) || 'UTC';
      setTimezone(tz);
    });
  }, []);

  const updatePrefs = (update: Parameters<typeof setPrefs>[0]) => {
    setPrefs(update);
    setPrefsSaved(true);
    setTimeout(() => setPrefsSaved(false), 2000);
  };

  const handleSaveTimezone = async () => {
    setTzSaving(true);
    try {
      await settingsApi.update({ display_timezone: timezone });
      invalidateTimezoneCache(timezone);
      setTzSuccess(true);
      setTimeout(() => setTzSuccess(false), 3000);
    } finally {
      setTzSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPw.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPw !== confirmPw) {
      setError('New passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      await usersApi.changePassword(currentPw, newPw);
      setSuccess(true);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setError(e.response?.data?.error?.message ?? 'Failed to change password. Check your current password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedLayout>
      <div className="max-w-xl space-y-6">
        <PageHeader title="Admin User" description="Manage your admin account credentials." />

        {/* Current account info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCircleIcon className="h-4 w-4" />
              Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-lg font-bold text-white">
                {user?.email.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="group flex items-center gap-1.5">
                  <p className={`font-medium text-foreground ${prefs.truncateEmails ? '' : 'max-w-[220px] truncate'}`}
                    title={prefs.truncateEmails && truncateEmail(user?.email ?? '') !== (user?.email ?? '') ? user?.email : !prefs.truncateEmails ? user?.email : undefined}>
                    {prefs.truncateEmails ? truncateEmail(user?.email ?? '') : user?.email}
                  </p>
                  <button type="button" onClick={() => { if (user?.email) void copyToClipboard(user.email, 'email'); }} title="Copy email"
                    className={`transition-colors ${isCopied('email') ? 'text-emerald-500' : 'text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground'}`}>
                    <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <ShieldCheckIcon className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-xs text-emerald-600 font-medium">Super Admin</span>
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-muted border px-4 py-3 text-sm text-muted-foreground space-y-1">
              <p>
                <span className="font-medium">Login email:</span> configured via{' '}
                <code className="rounded bg-muted px-1 text-xs">ADMIN_USERNAME</code> env var
              </p>
              <p>
                <span className="font-medium">Role:</span> super_admin (full access)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Change password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyIcon className="h-4 w-4" />
              Change Password
            </CardTitle>
            <CardDescription>
              Password changes are persisted immediately and survive server restarts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleChangePassword(e)} className="space-y-4">
              <div>
                <Label htmlFor="current_pw" className="text-sm font-medium">Current password</Label>
                <Input
                  id="current_pw"
                  type="password"
                  value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                  className="mt-1.5"
                  autoComplete="current-password"
                  required
                />
              </div>
              <div>
                <Label htmlFor="new_pw" className="text-sm font-medium">New password</Label>
                <Input
                  id="new_pw"
                  type="password"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  className="mt-1.5"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">Minimum 8 characters</p>
              </div>
              <div>
                <Label htmlFor="confirm_pw" className="text-sm font-medium">Confirm new password</Label>
                <Input
                  id="confirm_pw"
                  type="password"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  className="mt-1.5"
                  autoComplete="new-password"
                  required
                />
              </div>

              {error && (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  <CheckCircleIcon className="h-4 w-4" />
                  Password changed successfully.
                </div>
              )}

              <Button type="submit" disabled={saving || !currentPw || !newPw || !confirmPw}>
                {saving ? 'Updating…' : 'Update password'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Display timezone */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GlobeAltIcon className="h-4 w-4" />
              Display Timezone
            </CardTitle>
            <CardDescription>
              Dates and times across the admin panel will be shown in this timezone.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="timezone" className="text-sm font-medium">Timezone</Label>
              <select
                id="timezone"
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                className="mt-1.5 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {TIMEZONE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            {tzSuccess && (
              <div className="flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <CheckCircleIcon className="h-4 w-4" />
                Timezone saved.
              </div>
            )}
            <Button onClick={() => void handleSaveTimezone()} disabled={tzSaving}>
              {tzSaving ? 'Saving…' : 'Save timezone'}
            </Button>
          </CardContent>
        </Card>

        {/* Display preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Display Preferences
            </CardTitle>
            <CardDescription>
              Control what extra information is visible across the admin panel.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border p-3 hover:bg-accent">
              <div>
                <p className="text-sm font-medium text-foreground">Show geo info (flag, city, country)</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Displays location data captured from the visitor&apos;s IP on leads and waitlist entries.
                </p>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4 accent-foreground"
                checked={prefs.showGeoInfo}
                onChange={e => updatePrefs({ showGeoInfo: e.target.checked })}
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border p-3 hover:bg-accent">
              <div>
                <p className="text-sm font-medium text-foreground">Truncate long emails</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Shortens long email addresses in tables. Full email is always available on hover and via copy.
                </p>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4 accent-foreground"
                checked={prefs.truncateEmails}
                onChange={e => updatePrefs({ truncateEmails: e.target.checked })}
              />
            </label>
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Default dashboard date range</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  The activity chart range shown on the dashboard for new sessions.
                </p>
              </div>
              <select
                className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                value={prefs.defaultDashboardDays}
                onChange={e => {
                  updatePrefs({ defaultDashboardDays: parseInt(e.target.value, 10) as 7 | 14 | 30 | 90 });
                  localStorage.removeItem('dashboard_date_range');
                }}
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>
            {prefsSaved && (
              <p className="flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircleIcon className="h-3.5 w-3.5" />
                Saved
              </p>
            )}
          </CardContent>
        </Card>

        {/* Future note */}
        <div className="rounded-lg border border-dashed border-border bg-muted px-4 py-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Multi-user support</p>
          <p>This version supports a single admin account. Multi-user roles (editor, viewer, etc.) are planned for a future release.</p>
        </div>
      </div>
    </ProtectedLayout>
  );
}
