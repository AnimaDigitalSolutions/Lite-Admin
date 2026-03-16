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

interface Site {
  id: number;
  name: string;
  domain?: string;
  description?: string;
  api_key: string;
  is_active: boolean;
  created_at: string;
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
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sites & API Keys</h1>
            <p className="mt-1 text-sm text-gray-500">
              Each site gets a unique key. External forms send{' '}
              <code className="rounded bg-gray-100 px-1 text-xs font-mono">X-Site-Key: lsk_…</code>{' '}
              to tag submissions.
            </p>
          </div>
          <Button size="sm" onClick={() => setShowNewSite(v => !v)}>
            <PlusIcon className="mr-1.5 h-4 w-4" />
            New site
          </Button>
        </div>

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
          <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
        ) : sites.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-gray-400">
              <GlobeAltIcon className="mx-auto mb-3 h-8 w-8 text-gray-300" />
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
                      <span className="font-semibold text-sm text-gray-900">{site.name}</span>
                      {site.domain && (
                        <span className="text-xs text-gray-400">{site.domain}</span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        site.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {site.is_active ? 'active' : 'inactive'}
                      </span>
                    </div>
                    {site.description && (
                      <p className="text-xs text-gray-500">{site.description}</p>
                    )}
                    <div className="flex items-center gap-1.5">
                      <code className="flex-1 truncate rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700 max-w-xs">
                        {site.api_key}
                      </code>
                      <button
                        onClick={() => void copyToClipboard(site.api_key, site.id)}
                        className="rounded p-1 hover:bg-gray-100 transition-colors"
                        title="Copy key"
                      >
                        {isCopied(site.id)
                          ? <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-500" />
                          : <ClipboardDocumentIcon className="h-3.5 w-3.5 text-gray-400" />
                        }
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Created {new Date(site.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Toggle checked={site.is_active} onChange={v => void handleToggle(site.id, v)} size="sm" />
                    <button
                      onClick={() => void handleRegenerate(site.id)}
                      className="rounded p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                      title="Regenerate key"
                    >
                      <ArrowPathIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => void handleDelete(site.id)}
                      className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
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
          <Card className="bg-gray-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-gray-500">Usage example</CardTitle>
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
