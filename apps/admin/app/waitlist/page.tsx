'use client';

import { useState, useEffect, useCallback } from 'react';
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
  ChevronUpIcon,
  PlusIcon,
  XMarkIcon,
  ClipboardDocumentIcon,
  PencilSquareIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface WaitlistEntry {
  id: string;
  email: string;
  name?: string;
  signed_up_at: string;
  ip_address?: string;
  country?: string;
  country_name?: string;
  city?: string;
  region?: string;
}

const EMPTY_WAITLIST_FORM = { email: '', name: '' };

export default function WaitlistPage() {
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
  const [editForm, setEditForm] = useState({ name: '', email: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const startEdit = (entry: WaitlistEntry) => {
    setEditingId(entry.id);
    setEditForm({ name: entry.name ?? '', email: entry.email });
    setEditError(null);
  };

  const cancelEdit = () => { setEditingId(null); setEditError(null); };

  const saveEdit = async (id: string) => {
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await waitlistApi.update(id, editForm);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
      const response = await waitlistApi.list({
        limit: itemsPerPage,
        offset
      });
      
      setEntries(response.data || []);
      setTotalPages(Math.ceil((response.pagination?.total || 0) / itemsPerPage));
    } catch {
      setPageError('Failed to load waitlist entries. Please refresh the page.');
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
      link.download = `waitlist-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setPageError('Failed to export waitlist. Please try again.');
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
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedEntries(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedEntries.size === 0) return;
    if (!confirm(`Delete ${selectedEntries.size} waitlist entry(s)?`)) return;
    try {
      await waitlistApi.bulkDelete(Array.from(selectedEntries).map(Number));
      setEntries(prev => prev.filter(e => !selectedEntries.has(e.id)));
      setSelectedEntries(new Set());
    } catch {
      setPageError('Failed to delete selected entries. Please try again.');
    }
  };

  // Count occurrences of each IP in the current page (for duplicate badge)
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
          ? `Test waitlist email sent successfully! ${result.data.email_sent ? 'Email delivered.' : 'Email queued.'} Test entry ID: ${result.data.id}`
          : result.error?.message || 'Failed to send test email'
      });

      // Reload entries to show the new test entry
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

  const filteredEntries = entries.filter(entry => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      entry.email?.toLowerCase().includes(search) ||
      entry.name?.toLowerCase().includes(search)
    );
  });

  const countryFlag = (iso: string) => {
    if (!iso || iso.length !== 2) return '';
    return String.fromCodePoint(...[...iso.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0)));
  };

  const getRecentSignups = () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return entries.filter(entry => 
      new Date(entry.signed_up_at) > sevenDaysAgo
    ).length;
  };

  const getMonthlySignups = () => {
    const currentMonth = new Date().getMonth();
    return entries.filter(entry => 
      new Date(entry.signed_up_at).getMonth() === currentMonth
    ).length;
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
            <h1 className="text-2xl font-bold text-gray-900">Waitlist Management</h1>
            <p className="mt-2 text-gray-600">Manage your product waitlist signups</p>
          </div>
          <div className="flex gap-2">
            {selectedEntries.size > 0 && (
              <Button
                variant="destructive"
                onClick={handleBulkDelete}
                className="flex items-center gap-2"
              >
                <TrashIcon className="h-4 w-4" />
                Delete ({selectedEntries.size})
              </Button>
            )}
            <Button variant="outline" onClick={() => { setShowAddEntry(true); setAddEntryError(null); }} className="flex items-center gap-2">
              <PlusIcon className="h-4 w-4" />
              Add to Waitlist
            </Button>
            <Button onClick={handleExportCSV} className="flex items-center gap-2">
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
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <UsersIcon className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Total Signups</p>
                  <p className="text-2xl font-bold">{entries.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CalendarIcon className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">This Month</p>
                  <p className="text-2xl font-bold">{getMonthlySignups()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <ArrowTrendingUpIcon className="h-8 w-8 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-600">Last 7 Days</p>
                  <p className="text-2xl font-bold">{getRecentSignups()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <EnvelopeIcon className="h-8 w-8 text-orange-600" />
                <div>
                  <p className="text-sm text-gray-600">With Names</p>
                  <p className="text-2xl font-bold">
                    {entries.filter(e => e.name).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Email Testing */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <PaperAirplaneIcon className="h-5 w-5 text-blue-600" />
                Test Waitlist Email
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTestEmail(!showTestEmail)}
              >
                {showTestEmail ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
          {showTestEmail && (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Test Email Address *
                  </label>
                  <Input
                    type="email"
                    value={testEmailData.test_email}
                    onChange={(e) => setTestEmailData(prev => ({ ...prev, test_email: e.target.value }))}
                    placeholder="your.email@example.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Test Name (Optional)
                  </label>
                  <Input
                    value={testEmailData.name}
                    onChange={(e) => setTestEmailData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Jane Smith"
                  />
                </div>
              </div>
              
              {testEmailResult && (
                <div className={`p-3 rounded-md ${testEmailResult.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                  {testEmailResult.message}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleTestEmail}
                  disabled={testEmailLoading || !testEmailData.test_email}
                  className="flex items-center gap-2"
                >
                  <PaperAirplaneIcon className="h-4 w-4" />
                  {testEmailLoading ? 'Sending...' : 'Send Test Waitlist Email'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setTestEmailData({
                      test_email: '',
                      name: 'Jane Smith'
                    });
                    setTestEmailResult(null);
                  }}
                >
                  Reset Form
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Waitlist Table */}
        <Card>
          <CardHeader>
            <CardTitle>Waitlist Entries ({filteredEntries.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading waitlist...</div>
            ) : filteredEntries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? 'No entries match your search' : 'No waitlist signups yet'}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 w-8">
                          <input
                            type="checkbox"
                            checked={selectedEntries.size === filteredEntries.length && filteredEntries.length > 0}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            className="rounded"
                          />
                        </th>
                        <th className="text-left p-3 font-medium">Name</th>
                        <th className="text-left p-3 font-medium">Email</th>
                        <th className="text-left p-3 font-medium">Signup Date</th>
                        <th className="text-left p-3 font-medium">IP Address</th>
                        <th className="text-left p-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntries.map((entry) => (
                        <tr key={entry.id} className={`border-b ${editingId === entry.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={selectedEntries.has(entry.id)}
                              onChange={(e) => handleSelectEntry(entry.id, e.target.checked)}
                              className="rounded"
                            />
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
                                  <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                                </button>
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
                                        <span title={entry.country_name ?? entry.country}>
                                          {countryFlag(entry.country)}
                                        </span>
                                      )}
                                      <span className="font-mono text-xs text-gray-400">{entry.ip_address}</span>
                                      {priv && (
                                        <span className="text-xs text-gray-400 italic">private</span>
                                      )}
                                      {(ipCounts[entry.ip_address!] ?? 0) > 1 && (
                                        <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-600"
                                          title={`${ipCounts[entry.ip_address!]} entries from this IP`}>
                                          ×{ipCounts[entry.ip_address!]}
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
                              <span className="text-gray-400">—</span>
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
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setSelectedEntries(new Set([entry.id]));
                                    void handleBulkDelete();
                                  }}
                                >
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
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="flex items-center justify-center gap-2 h-20"
                onClick={() => void handleExportCSV()}
              >
                <ArrowDownTrayIcon className="h-6 w-6" />
                <div className="text-center">
                  <div className="font-medium">Export CSV</div>
                  <div className="text-xs text-gray-500">Download all data</div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="flex items-center justify-center gap-2 h-20"
                onClick={async () => {
                  const emails = entries.map(e => e.email).join(', ');
                  await navigator.clipboard.writeText(emails);
                }}
              >
                <ClipboardDocumentIcon className="h-6 w-6" />
                <div className="text-center">
                  <div className="font-medium">Copy All Emails</div>
                  <div className="text-xs text-gray-500">Comma-separated list</div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add to Waitlist Modal */}
      {showAddEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Add to Waitlist</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowAddEntry(false)}>
                  <XMarkIcon className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <Input
                    type="email"
                    value={addEntryForm.email}
                    onChange={e => setAddEntryForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name (optional)</label>
                  <Input
                    value={addEntryForm.name}
                    onChange={e => setAddEntryForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Jane Doe"
                  />
                </div>

                {addEntryError && (
                  <div className="p-3 rounded-md bg-red-50 text-red-800 border border-red-200 text-sm">
                    {addEntryError}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button onClick={() => void handleAddEntry()} disabled={addEntryLoading} className="flex items-center gap-2">
                    <PlusIcon className="h-4 w-4" />
                    {addEntryLoading ? 'Adding...' : 'Add to Waitlist'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowAddEntry(false)}>Cancel</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </ProtectedLayout>
  );
}