'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTimezone } from '@/lib/timezone';
import { useDisplayPrefs } from '@/lib/display-prefs';
import { isPrivateIp, truncateEmail } from '@/lib/utils';
import ProtectedLayout from '@/components/protected-layout';
import { submissionsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  MagnifyingGlassIcon,
  TrashIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  CalendarIcon,
  EnvelopeIcon,
  BuildingOfficeIcon,
  XMarkIcon,
  PlusIcon,
  TableCellsIcon,
  ViewColumnsIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import ContactDetailPanel, { getStatusBadge } from '@/components/contact-detail-panel';
import ContactsCalendar from '@/components/contacts-calendar';
import ContactsKanban from '@/components/contacts-kanban';
import AddContactModal from './components/add-contact-modal';
import TestEmailPanel from './components/test-email-panel';

type ContactStatus = 'new' | 'reviewed' | 'contacted' | 'qualified' | 'proposal_sent' | 'won' | 'lost' | 'archived';
type ViewMode = 'table' | 'kanban' | 'calendar';

interface Contact {
  id: string;
  name: string;
  email: string;
  company?: string;
  project_type?: string;
  message: string;
  submitted_at: string;
  ip_address?: string;
  user_agent?: string;
  country?: string;
  country_name?: string;
  city?: string;
  region?: string;
  status?: ContactStatus;
  follow_up_at?: string;
  status_changed_at?: string;
}

export default function ContactsPage() {
  const { formatDate } = useTimezone();
  const { prefs } = useDisplayPrefs();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20;

  const [pageError, setPageError] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ContactStatus | ''>('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [todosSummary, setTodosSummary] = useState<{ total: number; contacts: number } | null>(null);
  const [todoContactIds, setTodoContactIds] = useState<Set<string>>(new Set());
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [statusHistory, setStatusHistory] = useState<Record<number, { status: string; changed_at: string }[]>>({});


  const copyEmail = async (email: string) => {
    await navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const handleContactUpdated = (updated: Contact) => {
    setSelectedContact(updated);
    setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  // Add contact modal
  const [showAddContact, setShowAddContact] = useState(false);

  const loadContacts = useCallback(async () => {
    try {
      const offset = (currentPage - 1) * itemsPerPage;
      const response = await submissionsApi.list({
        limit: itemsPerPage,
        offset
      });
      
      setContacts(response.data || []);
      setTotalPages(Math.ceil((response.pagination?.total || 0) / itemsPerPage));
    } catch {
      setPageError('Failed to load contacts. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage]);

  const loadTodosSummary = useCallback(async () => {
    try {
      const [summaryRes, idsRes] = await Promise.all([
        submissionsApi.getTodosSummary(),
        submissionsApi.getTodoContactIds(),
      ]);
      setTodosSummary(summaryRes.data);
      setTodoContactIds(new Set((idsRes.data as number[]).map(String)));
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    void loadContacts();
    void loadTodosSummary();
  }, [loadContacts, loadTodosSummary]);

  // Fetch status history for Gantt view when contacts change
  useEffect(() => {
    if (viewMode !== 'calendar' || contacts.length === 0) return;
    const ids = contacts.map(c => Number(c.id)).filter(id => !isNaN(id));
    if (ids.length === 0) return;
    submissionsApi.getStatusHistory(ids)
      .then(res => setStatusHistory(res.data || {}))
      .catch(() => { /* silently fail — Gantt falls back to single-color bars */ });
  }, [contacts, viewMode]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contact submission?')) return;
    try {
      await submissionsApi.delete(id);
      setContacts(prev => prev.filter(contact => contact.id !== id));
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    } catch {
      setPageError('Failed to delete contact. Please try again.');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(filteredContacts.map(c => c.id)) : new Set());
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds(prev => { const n = new Set(prev); checked ? n.add(id) : n.delete(id); return n; });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected contact(s)?`)) return;
    try {
      await submissionsApi.bulkDelete(Array.from(selectedIds).map(Number));
      setContacts(prev => prev.filter(c => !selectedIds.has(c.id)));
      setSelectedIds(new Set());
    } catch {
      setPageError('Failed to delete selected contacts. Please try again.');
    }
  };

  const handleExportCSV = async () => {
    try {
      // Create CSV content
      const headers = ['Name', 'Email', 'Company', 'Project Type', 'Message', 'Date', 'IP Address'];
      const csvContent = [
        headers.join(','),
        ...filteredContacts.map(contact => [
          `"${contact.name || ''}"`,
          `"${contact.email || ''}"`,
          `"${contact.company || ''}"`,
          `"${contact.project_type || ''}"`,
          `"${contact.message?.replace(/"/g, '""') || ''}"`,
          `"${formatDate(contact.submitted_at, { hour: undefined, minute: undefined })}"`,
          `"${contact.ip_address || ''}"`
        ].join(','))
      ].join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `contacts-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } catch {
      setPageError('Failed to export CSV. Please try again.');
    }
  };

  // Parse filter tokens (e.g. "has:company is:this-month john") from search
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
    { token: 'is:this-month', label: 'Submitted this month' },
    { token: 'is:last-7-days', label: 'Last 7 days' },
    { token: 'has:company', label: 'Has company field' },
    { token: 'has:todos', label: 'Has open todos' },
    { token: '-is:this-month', label: 'Not this month' },
    { token: '-is:last-7-days', label: 'Not last 7 days' },
    { token: '-has:company', label: 'No company field' },
    { token: '-has:todos', label: 'No open todos' },
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

  const filteredContacts = contacts.filter(contact => {
    if (statusFilter && (contact.status || 'new') !== statusFilter) return false;

    // Apply filter tokens (positive and negated)
    const thisMonth = testFilter('is:this-month');
    if (thisMonth !== null) {
      const now = new Date();
      const d = new Date(contact.submitted_at);
      const isThisMonth = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (thisMonth && !isThisMonth) return false;
      if (!thisMonth && isThisMonth) return false;
    }
    const last7 = testFilter('is:last-7-days');
    if (last7 !== null) {
      const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const isRecent = new Date(contact.submitted_at) > sevenDaysAgo;
      if (last7 && !isRecent) return false;
      if (!last7 && isRecent) return false;
    }
    const hasCompany = testFilter('has:company');
    if (hasCompany !== null) {
      if (hasCompany && !contact.company) return false;
      if (!hasCompany && contact.company) return false;
    }
    const hasTodos = testFilter('has:todos');
    if (hasTodos !== null) {
      const has = todoContactIds.has(String(contact.id));
      if (hasTodos && !has) return false;
      if (!hasTodos && has) return false;
    }

    // Text search on remaining terms
    if (!searchText) return true;
    const search = searchText.toLowerCase();
    return (
      contact.name?.toLowerCase().includes(search) ||
      contact.email?.toLowerCase().includes(search) ||
      contact.company?.toLowerCase().includes(search) ||
      contact.project_type?.toLowerCase().includes(search) ||
      contact.message?.toLowerCase().includes(search)
    );
  });

  const countryFlag = (iso: string) => {
    if (!iso || iso.length !== 2) return '';
    return String.fromCodePoint(...[...iso.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0)));
  };

  const highlightMatch = (text: string, search: string): React.ReactNode => {
    if (!search || !text) return text;
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    if (parts.length === 1) return text;
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === search.toLowerCase()
            ? <mark key={i} className="bg-yellow-200 rounded-sm px-0.5">{part}</mark>
            : part
        )}
      </>
    );
  };

  const getProjectTypeColor = (type?: string) => {
    const colors: Record<string, string> = {
      'web': 'bg-blue-100 text-blue-800',
      'mobile': 'bg-green-100 text-green-800',
      'desktop': 'bg-purple-100 text-purple-800',
      'consulting': 'bg-yellow-100 text-yellow-800',
      'other': 'bg-gray-100 text-gray-800'
    };
    return colors[type || 'other'] || colors.other;
  };

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        {pageError && (
          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {pageError}
            <button type="button" onClick={() => setPageError(null)} className="ml-4 text-red-500 hover:text-red-700">✕</button>
          </div>
        )}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Contact Submissions</h1>
            <p className="mt-2 text-gray-600">Manage customer inquiries and contact form submissions</p>
          </div>
          <div className="flex gap-2">
            {selectedIds.size > 0 && (
              <Button variant="destructive" onClick={() => void handleBulkDelete()} className="flex items-center gap-2">
                <TrashIcon className="h-4 w-4" />
                Delete ({selectedIds.size})
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowAddContact(true)} className="flex items-center gap-2">
              <PlusIcon className="h-4 w-4" />
              Add Contact
            </Button>
            <Button onClick={() => void handleExportCSV()} className="flex items-center gap-2">
              <ArrowDownTrayIcon className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Search + Status Filter + View Toggle */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              ref={inputRef}
              placeholder="Search contacts... (try has: or is:)"
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
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as ContactStatus | '')}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-w-[160px]"
          >
            <option value="">All statuses</option>
            <option value="new">New</option>
            <option value="reviewed">Reviewed</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="proposal_sent">Proposal Sent</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
            <option value="archived">Archived</option>
          </select>
          <div className="flex rounded-md border border-input overflow-hidden">
            {([
              { mode: 'table' as ViewMode, icon: TableCellsIcon, label: 'Table' },
              { mode: 'kanban' as ViewMode, icon: ViewColumnsIcon, label: 'Kanban' },
              { mode: 'calendar' as ViewMode, icon: CalendarDaysIcon, label: 'Timeline' },
            ]).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                title={label}
                className={`px-3 py-2 transition-colors ${
                  viewMode === mode
                    ? 'bg-gray-900 text-white'
                    : 'bg-background text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {([
            {
              icon: EnvelopeIcon, color: 'text-blue-600', label: 'Total Contacts',
              value: contacts.length, token: '__clear__' as string | null, extra: undefined as string | undefined,
            },
            {
              icon: CalendarIcon, color: 'text-green-600', label: 'This Month',
              value: contacts.filter(c => {
                const now = new Date(); const d = new Date(c.submitted_at);
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
              }).length,
              token: 'is:this-month', extra: undefined as string | undefined,
            },
            {
              icon: BuildingOfficeIcon, color: 'text-purple-600', label: 'With Company',
              value: contacts.filter(c => c.company).length, token: 'has:company', extra: undefined as string | undefined,
            },
            {
              icon: CheckCircleIcon, color: 'text-emerald-600', label: 'Open Todos',
              value: todosSummary?.total ?? '—', token: 'has:todos',
              extra: todosSummary && todosSummary.total > 0
                ? `across ${todosSummary.contacts} contact${todosSummary.contacts !== 1 ? 's' : ''}`
                : undefined,
            },
          ]).map(({ icon: Icon, color, label, value, token, extra }) => {
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
                      {extra && <p className="text-xs text-gray-400">{extra}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Email Testing */}
        <TestEmailPanel onEmailSent={() => void loadContacts()} />

        {/* Kanban View */}
        {viewMode === 'kanban' && (
          <ContactsKanban
            contacts={filteredContacts}
            selectedContactId={selectedContact?.id}
            onSelectContact={setSelectedContact}
            onContactUpdated={handleContactUpdated}
            formatDate={formatDate}
            searchTerm={searchText}
          />
        )}

        {/* Calendar View */}
        {viewMode === 'calendar' && (
          <ContactsCalendar
            calendarMonth={calendarMonth}
            setCalendarMonth={setCalendarMonth}
            contacts={filteredContacts}
            onSelectContact={setSelectedContact}
            selectedContactId={selectedContact?.id}
            searchTerm={searchText}
            statusHistory={statusHistory}
          />
        )}

        {/* Contacts Table */}
        {viewMode === 'table' && <Card>
          <CardHeader>
            <CardTitle>Contact Submissions ({filteredContacts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading contacts...</div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? 'No contacts match your search' : 'No contact submissions yet'}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b bg-gray-50">
                        <th className="p-3 w-8">
                          <div className={`${selectedIds.size > 0 ? 'opacity-100' : 'opacity-0 hover:opacity-100'} transition-opacity`}>
                            <input type="checkbox" className="rounded cursor-pointer"
                              checked={selectedIds.size === filteredContacts.length && filteredContacts.length > 0}
                              onChange={e => handleSelectAll(e.target.checked)} />
                          </div>
                        </th>
                        <th className="text-left p-3 font-medium">Name</th>
                        <th className="text-left p-3 font-medium">Email</th>
                        <th className="text-left p-3 font-medium">Company</th>
                        <th className="text-left p-3 font-medium">Project Type</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-left p-3 font-medium">Date</th>
                        <th className="text-left p-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredContacts.map((contact, idx) => {
                        const isViewing = selectedContact?.id === contact.id;
                        const isChecked = selectedIds.has(contact.id);
                        const rowBg = isViewing
                          ? 'bg-amber-50 border-l-2 border-l-amber-400 relative z-50'
                          : isChecked
                            ? 'bg-blue-50'
                            : idx % 2 === 1 ? 'bg-gray-50/50' : '';
                        return (
                        <tr key={contact.id} className={`border-b hover:bg-gray-100 ${rowBg} group/row`}>
                          <td className="p-3">
                            <div className={`${selectedIds.has(contact.id) ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100'} transition-opacity`}>
                              <input type="checkbox" className="rounded cursor-pointer"
                                checked={selectedIds.has(contact.id)}
                                onChange={e => handleSelectOne(contact.id, e.target.checked)} />
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="font-medium">{highlightMatch(contact.name, searchText)}</div>
                          </td>
                          <td className="p-3 max-w-[220px]">
                            <div className="group flex items-center gap-1.5">
                              <span className={`text-sm ${prefs.truncateEmails ? '' : 'truncate'}`}
                                title={prefs.truncateEmails && truncateEmail(contact.email) !== contact.email ? contact.email : !prefs.truncateEmails ? contact.email : undefined}>
                                {prefs.truncateEmails ? truncateEmail(contact.email) : contact.email}
                              </span>
                              <button type="button" onClick={() => void copyEmail(contact.email)} title="Copy email"
                                className={`transition-colors shrink-0 ${copiedEmail === contact.email ? 'text-emerald-500' : 'text-gray-400 opacity-0 group-hover:opacity-100 hover:text-gray-600'}`}>
                                {copiedEmail === contact.email ? <CheckIcon className="h-3.5 w-3.5" /> : <ClipboardDocumentIcon className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                          </td>
                          <td className="p-3">
                            {contact.company ? (
                              <span className="text-gray-900">{highlightMatch(contact.company, searchText)}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            {contact.project_type ? (
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getProjectTypeColor(contact.project_type)}`}>
                                {contact.project_type}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            {(() => {
                              const badge = getStatusBadge(contact.status);
                              return (
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
                                  {badge.label}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="p-3 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              {prefs.showGeoInfo && contact.country && !isPrivateIp(contact.ip_address ?? '') && (
                                <span title={contact.country_name ?? contact.country}>
                                  {countryFlag(contact.country)}
                                </span>
                              )}
                              {formatDate(contact.submitted_at)}
                            </div>
                            {prefs.showGeoInfo && contact.city && (
                              <div className="text-xs text-gray-400 mt-0.5">
                                {contact.city}{contact.country_name ? `, ${contact.country_name}` : ''}
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedContact(contact)}
                              >
                                <EyeIcon className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDelete(contact.id)}
                              >
                                <TrashIcon className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => prev - 1)}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => prev + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>}

        {/* Add Contact Modal */}
        <AddContactModal
          open={showAddContact}
          onClose={() => setShowAddContact(false)}
          onCreated={() => void loadContacts()}
        />

        {/* Contact Detail Panel */}
        {selectedContact && (
          <ContactDetailPanel
            contact={selectedContact}
            onClose={() => setSelectedContact(null)}
            onContactUpdated={handleContactUpdated}
          />
        )}
      </div>
    </ProtectedLayout>
  );
}