'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTimezone } from '@/lib/timezone';
import { useDisplayPrefs } from '@/lib/display-prefs';
import { isPrivateIp, truncateEmail } from '@/lib/utils';
import ProtectedLayout from '@/components/protected-layout';
import { waitlistApi, emailTestApi } from '@/lib/api';
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
  PaperAirplaneIcon,
  ChevronDownIcon,
  PlusIcon,
  XMarkIcon,
  PencilSquareIcon,
  CheckCircleIcon,
  TagIcon,
  ClipboardDocumentIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

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

const EMPTY_WAITLIST_FORM = { email: '', name: '' };

// === Subscribers Tab ===

function SubscribersTab() {
  const { formatDate } = useTimezone();
  const { prefs } = useDisplayPrefs();
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20;

  const [pageError, setPageError] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

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

  const copyEmail = async (email: string) => {
    await navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  // Add to waitlist states
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [addEntryLoading, setAddEntryLoading] = useState(false);
  const [addEntryError, setAddEntryError] = useState<string | null>(null);
  const [addEntryForm, setAddEntryForm] = useState(EMPTY_WAITLIST_FORM);

  // Test email states
  const [showTestEmail, setShowTestEmail] = useState(false);
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testEmailData, setTestEmailData] = useState({
    test_email: '',
    name: 'Jane Smith'
  });

  const loadEntries = useCallback(async () => {
    try {
      const offset = (currentPage - 1) * itemsPerPage;
      const response = await waitlistApi.list({ limit: itemsPerPage, offset });
      setEntries(response.data || []);
      setTotalPages(Math.ceil((response.pagination?.total || 0) / itemsPerPage));
    } catch {
      setPageError('Failed to load subscribers. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const handleAddEntry = async () => {
    if (!addEntryForm.email) {
      setAddEntryError('Email is required.');
      return;
    }
    setAddEntryLoading(true);
    setAddEntryError(null);
    try {
      await waitlistApi.create({ email: addEntryForm.email, name: addEntryForm.name || undefined });
      setShowAddEntry(false);
      setAddEntryForm(EMPTY_WAITLIST_FORM);
      void loadEntries();
    } catch (err) {
      const e = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setAddEntryError(e.response?.data?.error?.message ?? e.message ?? 'Failed to add entry');
    } finally {
      setAddEntryLoading(false);
    }
  };

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
    if (checked) {
      setSelectedEntries(new Set(filteredEntries.map(entry => entry.id)));
    } else {
      setSelectedEntries(new Set());
    }
  };

  const handleSelectEntry = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedEntries);
    if (checked) newSelected.add(id);
    else newSelected.delete(id);
    setSelectedEntries(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedEntries.size === 0) return;
    if (!confirm(`Delete ${selectedEntries.size} subscriber(s)?`)) return;
    try {
      await waitlistApi.bulkDelete(Array.from(selectedEntries).map(Number));
      setEntries(prev => prev.filter(e => !selectedEntries.has(e.id)));
      setSelectedEntries(new Set());
    } catch {
      setPageError('Failed to delete selected entries. Please try again.');
    }
  };

  const ipCounts = entries.reduce<Record<string, number>>((acc, e) => {
    if (e.ip_address) acc[e.ip_address] = (acc[e.ip_address] ?? 0) + 1;
    return acc;
  }, {});

  const handleTestEmail = async () => {
    if (!testEmailData.test_email) {
      setTestEmailResult({ success: false, message: 'Please enter a test email address' });
      return;
    }
    setTestEmailLoading(true);
    setTestEmailResult(null);
    try {
      const result = await emailTestApi.testWaitlist(testEmailData);
      setTestEmailResult({
        success: result.success,
        message: result.success
          ? `Test email sent successfully! ${result.data.email_sent ? 'Email delivered.' : 'Email queued.'} Test entry ID: ${result.data.id}`
          : result.error?.message || 'Failed to send test email'
      });
      void loadEntries();
    } catch (error) {
      const err = error as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setTestEmailResult({
        success: false,
        message: err.response?.data?.error?.message ?? err.message ?? 'Failed to send test email'
      });
    } finally {
      setTestEmailLoading(false);
    }
  };

  // Parse filter tokens from search
  const parseSearch = (raw: string) => {
    const tokens = new Set<string>();
    const negated = new Set<string>();
    const textParts: string[] = [];
    for (const part of raw.split(/\s+/)) {
      if (/^(has|is):[\w-]+$/i.test(part)) {
        tokens.add(part.toLowerCase());
      } else if (/^-(has|is):[\w-]+$/i.test(part)) {
        negated.add(part.slice(1).toLowerCase());
      } else if (part) {
        textParts.push(part);
      }
    }
    return { tokens, negated, text: textParts.join(' ') };
  };

  const toggleFilter = (token: string, e?: React.MouseEvent) => {
    const additive = e?.ctrlKey || e?.metaKey;
    const { tokens, negated, text } = parseSearch(searchTerm);
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const negEscaped = `-${escaped}`;

    if (tokens.has(token)) {
      // Active → negated
      const replaced = searchTerm.replace(new RegExp(`(?<=^|\\s)${escaped}(?=\\s|$)`, 'gi'), `-${token}`);
      setSearchTerm(replaced.trim());
    } else if (negated.has(token)) {
      // Negated → off
      setSearchTerm(searchTerm.replace(new RegExp(`\\s*${negEscaped}\\s*`, 'gi'), ' ').trim());
    } else if (additive) {
      setSearchTerm((searchTerm + ' ' + token).trim());
    } else {
      setSearchTerm((token + (text ? ' ' + text : '')).trim());
    }
  };

  // Autocomplete suggestions
  const FILTER_SUGGESTIONS = [
    { token: 'is:this-month', label: 'Signed up this month' },
    { token: 'is:last-7-days', label: 'Last 7 days' },
    { token: 'has:name', label: 'Has name field' },
    { token: '-is:this-month', label: 'Not this month' },
    { token: '-is:last-7-days', label: 'Not last 7 days' },
    { token: '-has:name', label: 'No name field' },
  ] as const;
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const getFilteredSuggestions = () => {
    const words = searchTerm.split(/\s+/);
    const lastWord = words[words.length - 1]?.toLowerCase() ?? '';
    if (!lastWord || (!lastWord.startsWith('i') && !lastWord.startsWith('h') && !lastWord.startsWith('-'))) return [];
    const { tokens, negated } = parseSearch(searchTerm);
    return FILTER_SUGGESTIONS.filter(s => {
      const bare = s.token.replace(/^-/, '');
      const isNeg = s.token.startsWith('-');
      if (isNeg ? negated.has(bare) : tokens.has(bare)) return false;
      return s.token.startsWith(lastWord);
    });
  };

  const filteredSuggestions = showSuggestions ? getFilteredSuggestions() : [];

  const applySuggestion = (token: string) => {
    const words = searchTerm.split(/\s+/);
    words[words.length - 1] = token;
    setSearchTerm(words.join(' ') + ' ');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const { tokens: activeFilters, negated: negatedFilters, text: searchText } = parseSearch(searchTerm);

  const testFilter = (key: string) => {
    if (activeFilters.has(key)) return true;
    if (negatedFilters.has(key)) return false;
    return null; // not set
  };

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

  const countryFlag = (iso: string) => {
    if (!iso || iso.length !== 2) return '';
    return String.fromCodePoint(...[...iso.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0)));
  };

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
      {pageError && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {pageError}
          <button type="button" onClick={() => setPageError(null)} className="ml-4 text-red-500 hover:text-red-700">&#10005;</button>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div />
        <div className="flex gap-2">
          {selectedEntries.size > 0 && (
            <Button variant="destructive" onClick={handleBulkDelete} className="flex items-center gap-2">
              <TrashIcon className="h-4 w-4" />
              Delete ({selectedEntries.size})
            </Button>
          )}
          <Button variant="outline" onClick={() => { setShowAddEntry(true); setAddEntryError(null); }} className="flex items-center gap-2">
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
            onChange={(e) => { setSearchTerm(e.target.value); setShowSuggestions(true); setSuggestionIndex(0); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={(e) => {
              if (!filteredSuggestions.length) return;
              if (e.key === 'ArrowDown') { e.preventDefault(); setSuggestionIndex(i => Math.min(i + 1, filteredSuggestions.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setSuggestionIndex(i => Math.max(i - 1, 0)); }
              else if (e.key === 'Enter' && filteredSuggestions[suggestionIndex]) { e.preventDefault(); applySuggestion(filteredSuggestions[suggestionIndex].token); }
              else if (e.key === 'Escape') setShowSuggestions(false);
            }}
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
      <Card>
        <button type="button" onClick={() => setShowTestEmail(!showTestEmail)} className="flex w-full items-center justify-between px-6 py-4 text-left">
          <CardTitle className="flex items-center gap-2">
            <PaperAirplaneIcon className="h-5 w-5 text-blue-600" />
            Test Subscriber Email
          </CardTitle>
          <ChevronDownIcon className={`h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200 ${showTestEmail ? 'rotate-180' : ''}`} />
        </button>
        {showTestEmail && (
          <CardContent className="space-y-4 border-t border-gray-100 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Test Email Address *</label>
                <Input type="email" value={testEmailData.test_email} onChange={(e) => setTestEmailData(prev => ({ ...prev, test_email: e.target.value }))} placeholder="your.email@example.com" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Test Name (Optional)</label>
                <Input value={testEmailData.name} onChange={(e) => setTestEmailData(prev => ({ ...prev, name: e.target.value }))} placeholder="Jane Smith" />
              </div>
            </div>
            {testEmailResult && (
              <div className={`p-3 rounded-md ${testEmailResult.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                {testEmailResult.message}
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={() => void handleTestEmail()} disabled={testEmailLoading || !testEmailData.test_email} className="flex items-center gap-2">
                <PaperAirplaneIcon className="h-4 w-4" />
                {testEmailLoading ? 'Sending...' : 'Send Test Email'}
              </Button>
              <Button variant="outline" onClick={() => { setTestEmailData({ test_email: '', name: 'Jane Smith' }); setTestEmailResult(null); }}>
                Reset Form
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

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
                              <button type="button" onClick={() => void copyEmail(entry.email)} title="Copy email"
                                className={`transition-colors shrink-0 ${copiedEmail === entry.email ? 'text-emerald-500' : 'text-gray-400 opacity-0 group-hover:opacity-100 hover:text-gray-600'}`}>
                                {copiedEmail === entry.email ? <CheckIcon className="h-3.5 w-3.5" /> : <ClipboardDocumentIcon className="h-3.5 w-3.5" />}
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

              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-6">
                  <Button variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}>Previous</Button>
                  <span className="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
                  <Button variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)}>Next</Button>
                </div>
              )}
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
            <Button variant="outline" className="flex items-center justify-center gap-2 h-20" onClick={async () => {
              const emails = entries.map(e => e.email).join(', ');
              await navigator.clipboard.writeText(emails);
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
      {showAddEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Add Subscriber</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowAddEntry(false)}>
                  <XMarkIcon className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <Input type="email" value={addEntryForm.email} onChange={e => setAddEntryForm(p => ({ ...p, email: e.target.value }))} placeholder="user@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name (optional)</label>
                  <Input value={addEntryForm.name} onChange={e => setAddEntryForm(p => ({ ...p, name: e.target.value }))} placeholder="Jane Doe" />
                </div>
                {addEntryError && (
                  <div className="p-3 rounded-md bg-red-50 text-red-800 border border-red-200 text-sm">{addEntryError}</div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button onClick={() => void handleAddEntry()} disabled={addEntryLoading} className="flex items-center gap-2">
                    <PlusIcon className="h-4 w-4" />
                    {addEntryLoading ? 'Adding...' : 'Add Subscriber'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowAddEntry(false)}>Cancel</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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
