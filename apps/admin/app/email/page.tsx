'use client';

import { useState, useEffect, useCallback } from 'react';
import ProtectedLayout from '@/components/protected-layout';
import { credentialsApi, emailTestApi } from '@/lib/api';
import { SecretField } from '@/components/ui/secret-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AtSymbolIcon,
  CheckCircleIcon,
  PaperAirplaneIcon,
  XCircleIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { ErrorBanner } from '@/components/ui/error-banner';
import { PageHeader } from '@/components/page-header';

interface EmailConfig {
  active_provider: string;
  ahasend_api_key: string;
  ahasend_account_id: string;
  resend_api_key: string;
  from_address: string;
  display_name: string;
  notification_address: string;
}

type Provider = 'ahasend' | 'resend';
type VerifyState = null | 'verifying' | 'ok' | 'fail';

export default function EmailPage() {
  const [config, setConfig] = useState<EmailConfig>({
    active_provider: 'ahasend',
    ahasend_api_key: '',
    ahasend_account_id: '',
    resend_api_key: '',
    from_address: '',
    display_name: '',
    notification_address: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [verifying, setVerifying] = useState<Record<Provider, boolean>>({ ahasend: false, resend: false });
  const [verified, setVerified] = useState<Record<Provider, VerifyState>>({ ahasend: null, resend: null });

  // Test email state
  const [testEmail, setTestEmail] = useState('');
  const [testType, setTestType] = useState<'contact' | 'waitlist'>('contact');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testOpen, setTestOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await credentialsApi.get();
      setConfig(res.data.email);
    } catch {
      setError('Failed to load email configuration.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await credentialsApi.update({ email: config });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async (provider: Provider) => {
    const key = provider === 'ahasend' ? config.ahasend_api_key : config.resend_api_key;
    if (!key.trim()) return;
    setVerifying(v => ({ ...v, [provider]: true }));
    setVerified(v => ({ ...v, [provider]: null }));
    try {
      const result = await credentialsApi.verifyKey(provider, key);
      setVerified(v => ({ ...v, [provider]: result.valid ? 'ok' : 'fail' }));
    } catch {
      setVerified(v => ({ ...v, [provider]: 'fail' }));
    } finally {
      setVerifying(v => ({ ...v, [provider]: false }));
    }
  };

  const handleTest = async () => {
    if (!testEmail.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      if (testType === 'contact') {
        await emailTestApi.testContact({
          test_email: testEmail,
          name: 'Test User',
          message: 'This is a test contact notification.',
        });
      } else {
        await emailTestApi.testWaitlist({ test_email: testEmail, name: 'Test User' });
      }
      setTestResult({ ok: true, message: `Test ${testType} email sent to ${testEmail}` });
    } catch {
      setTestResult({ ok: false, message: 'Failed to send test email. Check your API key and from address.' });
    } finally {
      setTesting(false);
    }
  };

  const set = (field: keyof EmailConfig) => (value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    // Reset verify state when key changes
    if (field === 'ahasend_api_key' || field === 'ahasend_account_id') {
      setVerified(v => ({ ...v, ahasend: null }));
    }
    if (field === 'resend_api_key') {
      setVerified(v => ({ ...v, resend: null }));
    }
  };

  if (loading) return (
    <ProtectedLayout>
      <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
    </ProtectedLayout>
  );

  const providers: { id: Provider; label: string }[] = [
    { id: 'ahasend', label: 'AhaSend' },
    { id: 'resend', label: 'Resend' },
  ];

  return (
    <ProtectedLayout>
      <div className="max-w-2xl space-y-6">
        <PageHeader title="Email" description="Configure how outgoing emails are sent and where admin notifications go." />

        <ErrorBanner message={error} onDismiss={() => setError(null)} />

        {/* Unified Email Provider card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><AtSymbolIcon className="h-4 w-4" />Email Provider</CardTitle>
            <CardDescription>Select your active provider and enter its credentials. Only the active provider&apos;s key is used.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {providers.map(({ id, label }) => {
              const active = config.active_provider === id;
              const v = verified[id];
              const isVerifying = verifying[id];
              return (
                <div
                  key={id}
                  onClick={() => setConfig(prev => ({ ...prev, active_provider: id }))}
                  className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                    active ? 'border-foreground bg-muted' : 'border-border hover:border-border'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      active ? 'border-foreground' : 'border-border'
                    }`}>
                      {active && <div className="h-2 w-2 rounded-full bg-foreground" />}
                    </div>
                    <span className={`text-sm font-semibold ${active ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
                    {v === 'ok' && <span className="ml-auto flex items-center gap-1 text-xs text-emerald-600"><CheckCircleIcon className="h-3.5 w-3.5" />Verified</span>}
                    {v === 'fail' && <span className="ml-auto flex items-center gap-1 text-xs text-red-600"><XCircleIcon className="h-3.5 w-3.5" />Invalid</span>}
                  </div>

                  <div className="space-y-3" onClick={e => e.stopPropagation()}>
                    {id === 'ahasend' && (
                      <div>
                        <Label className="text-sm font-medium">Account ID</Label>
                        <Input
                          className="mt-1.5 font-mono text-sm"
                          value={config.ahasend_account_id}
                          onChange={e => set('ahasend_account_id')(e.target.value)}
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          autoComplete="off"
                        />
                      </div>
                    )}
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <SecretField
                          label="API Key"
                          value={id === 'ahasend' ? config.ahasend_api_key : config.resend_api_key}
                          onChange={set(id === 'ahasend' ? 'ahasend_api_key' : 'resend_api_key')}
                          placeholder={id === 'resend' ? 're_…' : 'Your AhaSend key'}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 mb-0"
                        disabled={
                          isVerifying ||
                          !(id === 'ahasend' ? config.ahasend_api_key : config.resend_api_key)?.trim()
                        }
                        onClick={() => void handleVerify(id)}
                      >
                        {isVerifying ? 'Checking…' : 'Verify'}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Sender identity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sender Identity</CardTitle>
            <CardDescription>
              The <strong>From</strong> address and name that recipients see on every outgoing email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Display name</Label>
                <Input
                  className="mt-1.5"
                  value={config.display_name}
                  onChange={e => set('display_name')(e.target.value)}
                  placeholder="Anima Digital"
                  autoComplete="off"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">From address *</Label>
                <Input
                  className="mt-1.5"
                  type="email"
                  value={config.from_address}
                  onChange={e => set('from_address')(e.target.value)}
                  placeholder="noreply@yourdomain.com"
                  autoComplete="off"
                />
              </div>
            </div>
            <p className="rounded bg-muted px-3 py-2 text-xs text-muted-foreground border">
              Recipients will see: <span className="font-mono">{config.display_name || 'Lite Admin'} &lt;{config.from_address || 'noreply@…'}&gt;</span>
            </p>
          </CardContent>
        </Card>

        {/* Admin notification */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Admin Notification Email</CardTitle>
            <CardDescription>
              Where contact form submissions are sent. Use your actual inbox here — not a no-reply address.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Label className="text-sm font-medium">Notification address (TO)</Label>
            <Input
              className="mt-1.5"
              type="email"
              value={config.notification_address}
              onChange={e => set('notification_address')(e.target.value)}
              placeholder="you@yourdomain.com"
              autoComplete="off"
            />
            {!config.notification_address && (
              <p className="mt-2 text-xs text-amber-600 bg-amber-50 rounded px-3 py-2 border border-amber-200">
                No notification address set — contact form alerts will fall back to the From address.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Save */}
        <div className="flex items-center gap-3">
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : 'Save Email Settings'}
          </Button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircleIcon className="h-4 w-4" />
              Saved — provider reset
            </span>
          )}
        </div>

        {/* Send test email — collapsible */}
        <Card>
          <button
            type="button"
            onClick={() => setTestOpen(o => !o)}
            className="flex w-full items-center justify-between px-6 py-4 text-left"
          >
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <PaperAirplaneIcon className="h-4 w-4" />
                Send test email
              </CardTitle>
              <CardDescription className="mt-1">Verify your config is working before going live.</CardDescription>
            </div>
            <ChevronDownIcon className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${testOpen ? 'rotate-180' : ''}`} />
          </button>
          {testOpen && (
            <CardContent className="space-y-3 border-t border-border pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Send to</Label>
                  <Input
                    className="mt-1.5"
                    type="email"
                    value={testEmail}
                    onChange={e => setTestEmail(e.target.value)}
                    placeholder="your@inbox.com"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Template</Label>
                  <select
                    value={testType}
                    onChange={e => setTestType(e.target.value as 'contact' | 'waitlist')}
                    className="mt-1.5 w-full rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <option value="contact">Contact notification</option>
                    <option value="waitlist">Waitlist confirmation</option>
                  </select>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={testing || !testEmail.trim()}
                onClick={() => void handleTest()}
              >
                {testing ? 'Sending…' : 'Send test'}
              </Button>
              {testResult && (
                <div className={`rounded px-3 py-2 text-sm ${
                  testResult.ok
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {testResult.message}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </div>
    </ProtectedLayout>
  );
}
