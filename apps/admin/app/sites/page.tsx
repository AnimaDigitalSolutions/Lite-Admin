'use client';

import { useState, useEffect, useCallback } from 'react';
import ProtectedLayout from '@/components/protected-layout';
import { sitesApi } from '@/lib/api';
import { useCopyToClipboard } from '@/lib/hooks/use-copy-to-clipboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  GlobeAltIcon,
  PlusIcon,
  TrashIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Toggle } from '@/components/ui/toggle';
import { PageHeader } from '@/components/page-header';

interface Site {
  id: number;
  name: string;
  domain?: string;
  description?: string;
  api_key: string;
  permissions?: string;
  is_active: boolean;
  created_at: string;
}

const ALL_SCOPES = [
  { value: 'contact', label: 'Contact form' },
  { value: 'waitlist', label: 'Waitlist signup' },
] as const;

function parseSitePermissions(perms?: string): string[] {
  if (!perms) return ALL_SCOPES.map(s => s.value);
  return perms.split(',').map(s => s.trim()).filter(Boolean);
}

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewSite, setShowNewSite] = useState(false);
  const [newSite, setNewSite] = useState({ name: '', domain: '', description: '' });
  const [adding, setAdding] = useState(false);
  const { copy: copyToClipboard, isCopied } = useCopyToClipboard();

  const load = useCallback(async () => {
    try {
      const res = await sitesApi.list();
      setSites(res.data || []);
    } catch {
      setError('Failed to load sites.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleAdd = async () => {
    if (!newSite.name.trim()) return;
    setAdding(true);
    try {
      const res = await sitesApi.create(newSite);
      setSites(prev => [res.data, ...prev]);
      setNewSite({ name: '', domain: '', description: '' });
      setShowNewSite(false);
    } catch {
      setError('Failed to create site.');
    } finally {
      setAdding(false);
    }
  };

  const handleRegenerate = async (id: number) => {
    if (!confirm('Regenerate this key? The old key will stop working immediately.')) return;
    try {
      const res = await sitesApi.regenerateKey(id);
      setSites(prev => prev.map(s => s.id === id ? res.data : s));
    } catch {
      setError('Failed to regenerate key.');
    }
  };

  const handleToggle = async (id: number, isActive: boolean) => {
    try {
      const res = await sitesApi.toggle(id, isActive);
      setSites(prev => prev.map(s => s.id === id ? res.data : s));
    } catch {
      setError('Failed to update site.');
    }
  };

  const handlePermissionToggle = async (site: Site, scope: string) => {
    const current = parseSitePermissions(site.permissions);
    const updated = current.includes(scope)
      ? current.filter(s => s !== scope)
      : [...current, scope];
    // Optimistic update
    setSites(prev => prev.map(s => s.id === site.id ? { ...s, permissions: updated.join(',') } : s));
    try {
      const res = await sitesApi.updatePermissions(site.id, updated);
      setSites(prev => prev.map(s => s.id === site.id ? res.data : s));
    } catch {
      // Revert
      setSites(prev => prev.map(s => s.id === site.id ? site : s));
      setError('Failed to update permissions.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this site? The API key will stop working.')) return;
    try {
      await sitesApi.delete(id);
      setSites(prev => prev.filter(s => s.id !== id));
    } catch {
      setError('Failed to delete site.');
    }
  };

  return (
    <ProtectedLayout>
      <div className="max-w-3xl space-y-6">
        <PageHeader
          title="Sites & API Keys"
          description="Each site gets a unique key. External forms send X-Site-Key: lsk_… to tag submissions."
        >
          <Button size="sm" onClick={() => setShowNewSite(v => !v)}>
            <PlusIcon className="mr-1.5 h-4 w-4" />
            New site
          </Button>
        </PageHeader>

        <ErrorBanner message={error} onDismiss={() => setError(null)} />

        {/* New site form */}
        {showNewSite && (
          <Card className="border-dashed border-blue-300 bg-blue-50/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">New site</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Site name *</Label>
                  <Input
                    value={newSite.name}
                    onChange={e => setNewSite(p => ({ ...p, name: e.target.value }))}
                    placeholder="My Portfolio"
                    className="mt-1"
                    autoComplete="off"
                    onKeyDown={e => { if (e.key === 'Enter') void handleAdd(); }}
                  />
                </div>
                <div>
                  <Label className="text-xs">Domain</Label>
                  <Input
                    value={newSite.domain}
                    onChange={e => setNewSite(p => ({ ...p, domain: e.target.value }))}
                    placeholder="mysite.com"
                    className="mt-1"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Description (optional)</Label>
                <Input
                  value={newSite.description}
                  onChange={e => setNewSite(p => ({ ...p, description: e.target.value }))}
                  placeholder="Short description…"
                  className="mt-1"
                  autoComplete="off"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={() => void handleAdd()} disabled={adding || !newSite.name.trim()}>
                  {adding ? 'Creating…' : 'Create'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowNewSite(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Site list */}
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : sites.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              <GlobeAltIcon className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
              No sites yet. Create one above to start tagging form submissions.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sites.map(site => (
              <Card key={site.id} className={site.is_active ? '' : 'opacity-60'}>
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">{site.name}</span>
                      {site.domain && (
                        <span className="text-xs text-muted-foreground">{site.domain}</span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        site.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-accent text-muted-foreground'
                      }`}>
                        {site.is_active ? 'active' : 'inactive'}
                      </span>
                    </div>
                    {site.description && (
                      <p className="text-xs text-muted-foreground">{site.description}</p>
                    )}
                    <div className="flex items-center gap-1.5">
                      <code className="flex-1 truncate rounded bg-accent px-2 py-1 font-mono text-xs text-foreground max-w-xs">
                        {site.api_key}
                      </code>
                      <button
                        onClick={() => void copyToClipboard(site.api_key, site.id)}
                        className="rounded p-1 hover:bg-accent transition-colors"
                        title="Copy key"
                      >
                        {isCopied(site.id)
                          ? <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-500" />
                          : <ClipboardDocumentIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        }
                      </button>
                    </div>
                    <div className="flex items-center gap-3 pt-1">
                      <span className="text-[11px] font-medium text-muted-foreground">Permissions:</span>
                      {ALL_SCOPES.map(scope => {
                        const perms = parseSitePermissions(site.permissions);
                        const checked = perms.includes(scope.value);
                        return (
                          <label key={scope.value} className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => void handlePermissionToggle(site, scope.value)}
                              className="h-3.5 w-3.5 rounded border-border text-blue-600 cursor-pointer focus:ring-blue-500"
                            />
                            <span className={`text-[11px] ${checked ? 'text-foreground' : 'text-muted-foreground'}`}>{scope.label}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Created {new Date(site.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Toggle checked={site.is_active} onChange={v => void handleToggle(site.id, v)} size="sm" />
                    <button
                      onClick={() => void handleRegenerate(site.id)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-amber-50 hover:text-amber-600 transition-colors"
                      title="Regenerate key"
                    >
                      <ArrowPathIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => void handleDelete(site.id)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors"
                      title="Delete site"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Usage example */}
        {sites.length > 0 && (
          <Card className="bg-muted">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Usage example</CardTitle>
              <CardDescription className="text-xs">Add this header to your external contact/waitlist form submissions:</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="rounded bg-gray-900 px-4 py-3 text-xs text-gray-200 overflow-x-auto">{`fetch('https://your-api.com/api/forms/contact', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Site-Key': '${sites[0]?.api_key ?? 'lsk_…'}',
  },
  body: JSON.stringify({ name, email, message }),
})`}</pre>
            </CardContent>
          </Card>
        )}
      </div>
    </ProtectedLayout>
  );
}
