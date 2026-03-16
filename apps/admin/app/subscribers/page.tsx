'use client';

import { useState } from 'react';
import { usePaginatedData } from '@/lib/hooks/use-paginated-data';
import { useTimezone } from '@/lib/timezone';
import { useDisplayPrefs } from '@/lib/display-prefs';
import { isPrivateIp, truncateEmail } from '@/lib/utils';
import { useCopyToClipboard } from '@/lib/hooks/use-copy-to-clipboard';
import { useFacetedSearch } from '@/lib/hooks/use-faceted-search';
import { countryFlag } from '@/components/contact-detail/contact-utils';
import { Pagination } from '@/components/ui/pagination';
import ProtectedLayout from '@/components/protected-layout';
import { waitlistApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  MagnifyingGlassIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  CalendarIcon,
  UsersIcon,
  ArrowTrendingUpIcon,
  EnvelopeIcon,
  PlusIcon,
  XMarkIcon,
  PencilSquareIcon,
  CheckCircleIcon,
  TagIcon,
  ClipboardDocumentIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { ErrorBanner } from '@/components/ui/error-banner';
import { useSelection } from '@/lib/hooks/use-selection';
import AddSubscriberModal from './components/add-subscriber-modal';
import TestEmailPanel from './components/test-email-panel';

// === Types ===

interface WaitlistEntry {
  id: string;
  email: string;
  name?: string;
  tags?: string;
  signed_up_at: string;
  ip_address?: string;
  country?: string;
  country_name?: string;
  city?: string;
  region?: string;
}

// === Subscribers Tab ===

function SubscribersTab() {
  const { formatDate } = useTimezone();
  const { prefs } = useDisplayPrefs();
  const {
    data: entries, loading, currentPage, totalPages, setCurrentPage,
    refetch: loadEntries, setData: setEntries,
  } = usePaginatedData<WaitlistEntry>(
    (limit, offset) => waitlistApi.list({ limit, offset }),
    [],
    { pageSize: 20 },
  );
  const { selectedIds: selectedEntries, setSelectedIds: setSelectedEntries, selectAll, clearSelection } = useSelection<string>();

  const [pageError, setPageError] = useState<string | null>(null);
  const { copy: copyEmail, isCopied: isEmailCopied } = useCopyToClipboard();

  const FILTER_SUGGESTIONS = [
    { token: 'is:this-month', label: 'Signed up this month' },
    { token: 'is:last-7-days', label: 'Last 7 days' },
    { token: 'has:name', label: 'Has name field' },
    { token: '-is:this-month', label: 'Not this month' },
    { token: '-is:last-7-days', label: 'Not last 7 days' },
    { token: '-has:name', label: 'No name field' },
  ] as const;

  const {
    searchTerm, setSearchTerm, searchText,
    activeFilters, negatedFilters, testFilter, toggleFilter,
    setShowSuggestions, suggestionIndex,
    suggestionsRef, inputRef, filteredSuggestions, applySuggestion,
    onInputChange, onInputKeyDown,
  } = useFacetedSearch({ suggestions: FILTER_SUGGESTIONS });

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', tags: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const startEdit = (entry: WaitlistEntry) => {
    setEditingId(entry.id);
    const tags = entry.tags ? JSON.parse(entry.tags).join(', ') : '';
    setEditForm({ name: entry.name ?? '', email: entry.email, tags });
    setEditError(null);
  };

  const cancelEdit = () => { setEditingId(null); setEditError(null); };

  const saveEdit = async (id: string) => {
    setEditSaving(true);
    setEditError(null);
    try {
      const tagsArray = editForm.tags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);
      const tagsJson = tagsArray.length > 0 ? JSON.stringify(tagsArray) : undefined;
      const res = await waitlistApi.update(id, {
        name: editForm.name || undefined,
        email: editForm.email,
        tags: tagsJson,
      });
      const updated = res.data as WaitlistEntry;
      setEntries(prev => prev.map(e => e.id === id ? updated : e));
      setEditingId(null);
    } catch {
      setEditError('Failed to save. Please try again.');
    } finally {
      setEditSaving(false);
    }
  };

  // Add subscriber modal
  const [showAddEntry, setShowAddEntry] = useState(false);

  const handleExportCSV = async () => {
    try {
      const blob = await waitlistApi.export();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `subscribers-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setPageError('Failed to export subscribers. Please try again.');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    checked ? selectAll(filteredEntries.map(entry => entry.id)) : clearSelection();
  };

  const handleSelectEntry = (id: string, checked: boolean) => {
    setSelectedEntries(prev => { const n = new Set(prev); checked ? n.add(id) : n.delete(id); return n; });
  };

  const handleBulkDelete = async () => {
    if (selectedEntries.size === 0) return;
    if (!confirm(`Delete ${selectedEntries.size} subscriber(s)?`)) return;
    try {
      await waitlistApi.bulkDelete(Array.from(selectedEntries).map(Number));
      setEntries(prev => prev.filter(e => !selectedEntries.has(e.id)));
      clearSelection();
    } catch {
      setPageError('Failed to delete selected entries. Please try again.');
    }
  };

  const ipCounts = entries.reduce<Record<string, number>>((acc, e) => {
    if (e.ip_address) acc[e.ip_address] = (acc[e.ip_address] ?? 0) + 1;
    return acc;
  }, {});

  const filteredEntries = entries.filter(entry => {
    // Apply filter tokens (positive and negated)
    const thisMonth = testFilter('is:this-month');
    if (thisMonth !== null) {
      const now = new Date(); const d = new Date(entry.signed_up_at);
      const isThisMonth = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (thisMonth && !isThisMonth) return false;
      if (!thisMonth && isThisMonth) return false;
    }
    const recent = testFilter('is:last-7-days');
    if (recent !== null) {
      const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const isRecent = new Date(entry.signed_up_at) > sevenDaysAgo;
      if (recent && !isRecent) return false;
      if (!recent && isRecent) return false;
    }
    const hasName = testFilter('has:name');
    if (hasName !== null) {
      if (hasName && !entry.name) return false;
      if (!hasName && entry.name) return false;
    }

    // Text search
    if (!searchText) return true;
    const search = searchText.toLowerCase();
    return (
      entry.email?.toLowerCase().includes(search) ||
      entry.name?.toLowerCase().includes(search) ||
      (entry.tags && entry.tags.toLowerCase().includes(search))
    );
  });

  const getRecentSignups = () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return entries.filter(entry => new Date(entry.signed_up_at) > sevenDaysAgo).length;
  };

  const getMonthlySignups = () => {
    const currentMonth = new Date().getMonth();
    return entries.filter(entry => new Date(entry.signed_up_at).getMonth() === currentMonth).length;
  };

  const parseTags = (tags?: string): string[] => {
    if (!tags) return [];
    try { return JSON.parse(tags); } catch { return []; }
  };

  return (
    <div className="space-y-6">
      <ErrorBanner message={pageError} onDismiss={() => setPageError(null)} />

      <div className="flex justify-between items-center">
        <div />
        <div className="flex gap-2">
          {selectedEntries.size > 0 && (
            <Button variant="destructive" onClick={handleBulkDelete} className="flex items-center gap-2">
              <TrashIcon className="h-4 w-4" />
              Delete ({selectedEntries.size})
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowAddEntry(true)} className="flex items-center gap-2">
            <PlusIcon className="h-4 w-4" />
            Add Subscriber
          </Button>
          <Button onClick={() => void handleExportCSV()} className="flex items-center gap-2">
            <ArrowDownTrayIcon className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            ref={inputRef}
            placeholder="Search subscribers... (try has: or is:)"
            value={searchTerm}
            onChange={(e) => onInputChange(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={onInputKeyDown}
            className="pl-10 pr-8"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
          {filteredSuggestions.length > 0 && (
            <div ref={suggestionsRef} className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden">
              {filteredSuggestions.map((s, i) => (
                <button
                  key={s.token}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); applySuggestion(s.token); }}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between ${
                    i === suggestionIndex ? 'bg-gray-100' : 'hover:bg-gray-50'
                  }`}
                >
                  <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">{s.token}</code>
                  <span className="text-gray-500 text-xs">{s.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {([
          { icon: UsersIcon, color: 'text-blue-600', label: 'Total Subscribers', value: entries.length, token: '__clear__' as string | null },
          { icon: CalendarIcon, color: 'text-green-600', label: 'This Month', value: getMonthlySignups(), token: 'is:this-month' },
          { icon: ArrowTrendingUpIcon, color: 'text-purple-600', label: 'Last 7 Days', value: getRecentSignups(), token: 'is:last-7-days' },
          { icon: EnvelopeIcon, color: 'text-orange-600', label: 'With Names', value: entries.filter(e => e.name).length, token: 'has:name' },
        ]).map(({ icon: Icon, color, label, value, token }) => {
          const isClear = token === '__clear__';
          const isActive = token && !isClear ? activeFilters.has(token) : false;
          const isNegated = token && !isClear ? negatedFilters.has(token) : false;
          return (
            <Card
              key={label}
              className={`transition-all cursor-pointer hover:shadow-md ${
                isActive ? 'ring-2 ring-gray-900 bg-gray-50' : isNegated ? 'ring-2 ring-red-400 bg-red-50/50' : ''
              }`}
              onClick={isClear ? () => setSearchTerm('') : token ? (e: React.MouseEvent) => toggleFilter(token, e) : undefined}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Icon className={`h-8 w-8 ${color}`} />
                  <div>
                    <p className="text-sm text-gray-600">{label}</p>
                    <p className="text-2xl font-bold">{value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Email Testing */}
      <TestEmailPanel onEmailSent={() => void loadEntries()} />

      {/* Subscribers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Subscribers ({filteredEntries.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading subscribers...</div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? 'No entries match your search' : 'No subscribers yet'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 w-8">
                        <div className={`${selectedEntries.size > 0 ? 'opacity-100' : 'opacity-0 hover:opacity-100'} transition-opacity`}>
                          <input type="checkbox" checked={selectedEntries.size === filteredEntries.length && filteredEntries.length > 0} onChange={(e) => handleSelectAll(e.target.checked)} className="rounded cursor-pointer" />
                        </div>
                      </th>
                      <th className="text-left p-3 font-medium">Name</th>
                      <th className="text-left p-3 font-medium">Email</th>
                      <th className="text-left p-3 font-medium">Tags</th>
                      <th className="text-left p-3 font-medium">Signup Date</th>
                      <th className="text-left p-3 font-medium">IP Address</th>
                      <th className="text-left p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map((entry) => (
                      <tr key={entry.id} className={`border-b ${editingId === entry.id ? 'bg-blue-50' : 'hover:bg-gray-50'} group/row`}>
                        <td className="p-3">
                          <div className={`${selectedEntries.has(entry.id) ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100'} transition-opacity`}>
                            <input type="checkbox" checked={selectedEntries.has(entry.id)} onChange={(e) => handleSelectEntry(entry.id, e.target.checked)} className="rounded cursor-pointer" />
                          </div>
                        </td>
                        <td className="p-3">
                          {editingId === entry.id ? (
                            <Input className="h-8 text-sm" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Name (optional)" />
                          ) : entry.name ? (
                            <span className="font-medium">{entry.name}</span>
                          ) : (
                            <span className="text-gray-400 italic">No name</span>
                          )}
                        </td>
                        <td className="p-3">
                          {editingId === entry.id ? (
                            <div className="space-y-1">
                              <Input className="h-8 text-sm" type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} required />
                              {editError && <p className="text-xs text-red-600">{editError}</p>}
                            </div>
                          ) : (
                            <div className="group flex items-center gap-1.5 max-w-[220px]">
                              <span className={`text-sm ${prefs.truncateEmails ? '' : 'truncate'}`}
                                title={prefs.truncateEmails && truncateEmail(entry.email) !== entry.email ? entry.email : !prefs.truncateEmails ? entry.email : undefined}>
                                {prefs.truncateEmails ? truncateEmail(entry.email) : entry.email}
                              </span>
                              <button type="button" onClick={() => void copyEmail(entry.email, entry.email)} title="Copy email"
                                className={`transition-colors shrink-0 ${isEmailCopied(entry.email) ? 'text-emerald-500' : 'text-gray-400 opacity-0 group-hover:opacity-100 hover:text-gray-600'}`}>
                                {isEmailCopied(entry.email) ? <CheckIcon className="h-3.5 w-3.5" /> : <ClipboardDocumentIcon className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          {editingId === entry.id ? (
                            <Input className="h-8 text-sm" value={editForm.tags} onChange={e => setEditForm(f => ({ ...f, tags: e.target.value }))} placeholder="tag1, tag2" />
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {parseTags(entry.tags).map(tag => (
                                <span key={tag} className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                                  <TagIcon className="h-3 w-3" />
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-sm text-gray-600">
                          {formatDate(entry.signed_up_at)}
                        </td>
                        <td className="p-3">
                          {prefs.showGeoInfo ? (
                            entry.ip_address ? (() => {
                              const priv = isPrivateIp(entry.ip_address!);
                              return (
                                <div>
                                  <span className="inline-flex items-center gap-1">
                                    {!priv && entry.country && (
                                      <span title={entry.country_name ?? entry.country}>{countryFlag(entry.country)}</span>
                                    )}
                                    <span className="font-mono text-xs text-gray-400">{entry.ip_address}</span>
                                    {priv && <span className="text-xs text-gray-400 italic">private</span>}
                                    {(ipCounts[entry.ip_address!] ?? 0) > 1 && (
                                      <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-600"
                                        title={`${ipCounts[entry.ip_address!]} entries from this IP`}>
                                        x{ipCounts[entry.ip_address!]}
                                      </span>
                                    )}
                                  </span>
                                  {!priv && entry.city && (
                                    <div className="text-xs text-gray-400 mt-0.5">
                                      {entry.city}{entry.country_name ? `, ${entry.country_name}` : ''}
                                    </div>
                                  )}
                                </div>
                              );
                            })() : (
                              <span className="text-gray-400">-</span>
                            )
                          ) : (
                            <span className="text-gray-400">&mdash;</span>
                          )}
                        </td>
                        <td className="p-3">
                          {editingId === entry.id ? (
                            <div className="flex gap-1">
                              <Button size="sm" onClick={() => void saveEdit(entry.id)} disabled={editSaving}>
                                <CheckCircleIcon className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={cancelEdit}>
                                <XMarkIcon className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => startEdit(entry)}>
                                <PencilSquareIcon className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => { setSelectedEntries(new Set([entry.id])); void handleBulkDelete(); }}>
                                <TrashIcon className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button variant="outline" className="flex items-center justify-center gap-2 h-20" onClick={() => void handleExportCSV()}>
              <ArrowDownTrayIcon className="h-6 w-6" />
              <div className="text-center">
                <div className="font-medium">Export CSV</div>
                <div className="text-xs text-gray-500">Download all data</div>
              </div>
            </Button>
            <Button variant="outline" className="flex items-center justify-center gap-2 h-20" onClick={() => {
              const emails = entries.map(e => e.email).join(', ');
              void copyEmail(emails, '__all_emails__');
            }}>
              <ClipboardDocumentIcon className="h-6 w-6" />
              <div className="text-center">
                <div className="font-medium">Copy All Emails</div>
                <div className="text-xs text-gray-500">Comma-separated list</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add Subscriber Modal */}
      <AddSubscriberModal
        open={showAddEntry}
        onClose={() => setShowAddEntry(false)}
        onAdded={() => void loadEntries()}
      />
    </div>
  );
}

// === Main Page ===

export default function SubscribersPage() {
  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscribers</h1>
          <p className="mt-2 text-gray-600">Manage your subscribers</p>
        </div>
        <SubscribersTab />
      </div>
    </ProtectedLayout>
  );
}
