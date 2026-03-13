'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTimezone } from '@/lib/timezone';
import { useDisplayPrefs } from '@/lib/display-prefs';
import { isPrivateIp, truncateEmail } from '@/lib/utils';
import ProtectedLayout from '@/components/protected-layout';
import { submissionsApi, emailTestApi } from '@/lib/api';
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
  PaperAirplaneIcon,
  ChevronDownIcon,
  PlusIcon,
  ClipboardDocumentIcon,
  PencilSquareIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

type ProjectType = 'web' | 'mobile' | 'erp' | 'consulting' | 'other';

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
}

const EMPTY_CONTACT_FORM = {
  name: '',
  email: '',
  company: '',
  project_type: 'web' as ProjectType,
  message: '',
};

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

  // Detail panel edit mode
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<{ name: string; email: string; company: string; project_type: string; message: string }>({ name: '', email: '', company: '', project_type: '', message: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);


  const copyEmail = async (email: string) => {
    await navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const openEditMode = (contact: typeof selectedContact) => {
    if (!contact) return;
    const form = { name: contact.name, email: contact.email, company: contact.company ?? '', project_type: contact.project_type ?? '', message: contact.message };
    setEditForm(form);
    setEditError(null);
    setEditMode(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedContact) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await submissionsApi.update(selectedContact.id, editForm);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const updated = res.data as Contact;
      setSelectedContact(updated);
      setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
      setEditMode(false);
    } catch {
      setEditError('Failed to save changes. Please try again.');
    } finally {
      setEditSaving(false);
    }
  };

  // Add contact states
  const [showAddContact, setShowAddContact] = useState(false);
  const [addContactLoading, setAddContactLoading] = useState(false);
  const [addContactError, setAddContactError] = useState<string | null>(null);
  const [addContactForm, setAddContactForm] = useState(EMPTY_CONTACT_FORM);

  // Test email states
  const [showTestEmail, setShowTestEmail] = useState(false);
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testEmailData, setTestEmailData] = useState<{
    test_email: string;
    name: string;
    company: string;
    project_type: ProjectType;
    message: string;
  }>({
    test_email: '',
    name: 'John Doe',
    company: 'Test Company',
    project_type: 'web',
    message: 'This is a test message from the admin dashboard to verify email functionality is working correctly.'
  });

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

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

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

  const handleAddContact = async () => {
    if (!addContactForm.name || !addContactForm.email || !addContactForm.message) {
      setAddContactError('Name, email, and message are required.');
      return;
    }
    setAddContactLoading(true);
    setAddContactError(null);
    try {
      await submissionsApi.create(addContactForm);
      setShowAddContact(false);
      setAddContactForm(EMPTY_CONTACT_FORM);
      void loadContacts();
    } catch (err) {
      const e = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setAddContactError(e.response?.data?.error?.message ?? e.message ?? 'Failed to add contact');
    } finally {
      setAddContactLoading(false);
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

  const handleTestEmail = async () => {
    if (!testEmailData.test_email) {
      setTestEmailResult({ success: false, message: 'Please enter a test email address' });
      return;
    }

    setTestEmailLoading(true);
    setTestEmailResult(null);

    try {
      const result = await emailTestApi.testContact(testEmailData);
      
      setTestEmailResult({
        success: result.success,
        message: result.success 
          ? `Test email sent successfully! ${result.data.email_sent ? 'Email delivered.' : 'Email queued.'} Test entry ID: ${result.data.id}`
          : result.error?.message || 'Failed to send test email'
      });

      // Reload contacts to show the new test entry
      void loadContacts();
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

  const filteredContacts = contacts.filter(contact => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
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
    const idx = text.toLowerCase().indexOf(search.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-200 rounded-sm px-0.5">{text.slice(idx, idx + search.length)}</mark>
        {text.slice(idx + search.length)}
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
            <Button variant="outline" onClick={() => { setShowAddContact(true); setAddContactError(null); }} className="flex items-center gap-2">
              <PlusIcon className="h-4 w-4" />
              Add Contact
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
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <EnvelopeIcon className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Total Contacts</p>
                  <p className="text-2xl font-bold">{contacts.length}</p>
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
                  <p className="text-2xl font-bold">
                    {contacts.filter(c => 
                      new Date(c.submitted_at).getMonth() === new Date().getMonth()
                    ).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <BuildingOfficeIcon className="h-8 w-8 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-600">With Company</p>
                  <p className="text-2xl font-bold">
                    {contacts.filter(c => c.company).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Email Testing */}
        <Card>
          <button
            type="button"
            onClick={() => setShowTestEmail(!showTestEmail)}
            className="flex w-full items-center justify-between px-6 py-4 text-left"
          >
            <CardTitle className="flex items-center gap-2">
              <PaperAirplaneIcon className="h-5 w-5 text-blue-600" />
              Test Contact Email
            </CardTitle>
            <ChevronDownIcon className={`h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200 ${showTestEmail ? 'rotate-180' : ''}`} />
          </button>
          {showTestEmail && (
            <CardContent className="space-y-4 border-t border-gray-100 pt-4">
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
                    Test Name
                  </label>
                  <Input
                    value={testEmailData.name}
                    onChange={(e) => setTestEmailData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Test Company
                  </label>
                  <Input
                    value={testEmailData.company}
                    onChange={(e) => setTestEmailData(prev => ({ ...prev, company: e.target.value }))}
                    placeholder="Test Company"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Type
                  </label>
                  <select
                    value={testEmailData.project_type}
                    onChange={(e) => setTestEmailData(prev => ({ ...prev, project_type: e.target.value as ProjectType }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="web">Web Application</option>
                    <option value="mobile">Mobile App</option>
                    <option value="erp">ERP System</option>
                    <option value="consulting">Consulting</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Test Message
                </label>
                <textarea
                  value={testEmailData.message}
                  onChange={(e) => setTestEmailData(prev => ({ ...prev, message: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Test message content..."
                />
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
                  {testEmailLoading ? 'Sending...' : 'Send Test Email'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setTestEmailData({
                      test_email: '',
                      name: 'John Doe',
                      company: 'Test Company',
                      project_type: 'web',
                      message: 'This is a test message from the admin dashboard to verify email functionality is working correctly.'
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

        {/* Contacts Table */}
        <Card>
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
                          <input type="checkbox" className="rounded"
                            checked={selectedIds.size === filteredContacts.length && filteredContacts.length > 0}
                            onChange={e => handleSelectAll(e.target.checked)} />
                        </th>
                        <th className="text-left p-3 font-medium">Name</th>
                        <th className="text-left p-3 font-medium">Email</th>
                        <th className="text-left p-3 font-medium">Company</th>
                        <th className="text-left p-3 font-medium">Project Type</th>
                        <th className="text-left p-3 font-medium">Date</th>
                        <th className="text-left p-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredContacts.map((contact) => (
                        <tr key={contact.id} className={`border-b hover:bg-gray-50 ${selectedIds.has(contact.id) ? 'bg-blue-50' : ''} even:bg-gray-50/50`}>
                          <td className="p-3">
                            <input type="checkbox" className="rounded"
                              checked={selectedIds.has(contact.id)}
                              onChange={e => handleSelectOne(contact.id, e.target.checked)} />
                          </td>
                          <td className="p-3">
                            <div className="font-medium">{highlightMatch(contact.name, searchTerm)}</div>
                          </td>
                          <td className="p-3 max-w-[220px]">
                            <div className="group flex items-center gap-1.5">
                              <span className={`text-sm ${prefs.truncateEmails ? '' : 'truncate'}`}
                                title={prefs.truncateEmails && truncateEmail(contact.email) !== contact.email ? contact.email : !prefs.truncateEmails ? contact.email : undefined}>
                                {prefs.truncateEmails ? truncateEmail(contact.email) : contact.email}
                              </span>
                              <button type="button" onClick={() => void copyEmail(contact.email)} title="Copy email"
                                className={`transition-colors shrink-0 ${copiedEmail === contact.email ? 'text-emerald-500' : 'text-gray-400 opacity-0 group-hover:opacity-100 hover:text-gray-600'}`}>
                                <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="p-3">
                            {contact.company ? (
                              <span className="text-gray-900">{highlightMatch(contact.company, searchTerm)}</span>
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

        {/* Add Contact Modal */}
        {showAddContact && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-lg w-full">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold">Add Contact Manually</h2>
                  <Button variant="ghost" size="sm" onClick={() => setShowAddContact(false)}>
                    <XMarkIcon className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                      <Input
                        value={addContactForm.name}
                        onChange={e => setAddContactForm(p => ({ ...p, name: e.target.value }))}
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                      <Input
                        type="email"
                        value={addContactForm.email}
                        onChange={e => setAddContactForm(p => ({ ...p, email: e.target.value }))}
                        placeholder="john@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                      <Input
                        value={addContactForm.company}
                        onChange={e => setAddContactForm(p => ({ ...p, company: e.target.value }))}
                        placeholder="ACME Corp"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Project Type</label>
                      <select
                        value={addContactForm.project_type}
                        onChange={e => setAddContactForm(p => ({ ...p, project_type: e.target.value as ProjectType }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="web">Web Application</option>
                        <option value="mobile">Mobile App</option>
                        <option value="erp">ERP System</option>
                        <option value="consulting">Consulting</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                    <textarea
                      value={addContactForm.message}
                      onChange={e => setAddContactForm(p => ({ ...p, message: e.target.value }))}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Project details..."
                    />
                  </div>

                  {addContactError && (
                    <div className="p-3 rounded-md bg-red-50 text-red-800 border border-red-200 text-sm">
                      {addContactError}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button onClick={() => void handleAddContact()} disabled={addContactLoading} className="flex items-center gap-2">
                      <PlusIcon className="h-4 w-4" />
                      {addContactLoading ? 'Adding...' : 'Add Contact'}
                    </Button>
                    <Button variant="outline" onClick={() => setShowAddContact(false)}>Cancel</Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Contact Detail Modal */}
        {selectedContact && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold">Contact Details</h2>
                  <div className="flex items-center gap-2">
                    {!editMode && (
                      <Button variant="outline" size="sm" onClick={() => openEditMode(selectedContact)}>
                        <PencilSquareIcon className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedContact(null); setEditMode(false); }}>
                      <XMarkIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-6">
                  {editMode ? (
                    /* ── Edit mode ── */
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-600">Name</label>
                          <Input className="mt-1" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-600">Email</label>
                          <Input className="mt-1" type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-600">Company</label>
                          <Input className="mt-1" value={editForm.company} onChange={e => setEditForm(f => ({ ...f, company: e.target.value }))} placeholder="Optional" />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-600">Project Type</label>
                          <Input className="mt-1" value={editForm.project_type} onChange={e => setEditForm(f => ({ ...f, project_type: e.target.value }))} placeholder="web / mobile / erp…" />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Message</label>
                        <textarea
                          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          rows={5}
                          value={editForm.message}
                          onChange={e => setEditForm(f => ({ ...f, message: e.target.value }))}
                        />
                      </div>
                      <div className="rounded-lg bg-gray-50 border px-3 py-2 text-xs text-gray-500">
                        <span className="font-medium">Read-only:</span> ID, submitted date, IP address, and location cannot be changed.
                      </div>
                      {editError && (
                        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{editError}</div>
                      )}
                      <div className="flex gap-2">
                        <Button onClick={() => void handleSaveEdit()} disabled={editSaving}>
                          <CheckCircleIcon className="h-4 w-4 mr-1" />
                          {editSaving ? 'Saving…' : 'Save changes'}
                        </Button>
                        <Button variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                  /* ── View mode ── */
                  <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Name</label>
                      <p className="mt-1 text-lg">{selectedContact.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Email</label>
                      <div className="group mt-1 flex items-center gap-1.5">
                        <p className="text-lg max-w-[280px] truncate" title={selectedContact.email}>
                          {prefs.truncateEmails ? truncateEmail(selectedContact.email) : selectedContact.email}
                        </p>
                        <button type="button" onClick={() => void copyEmail(selectedContact.email)} title="Copy email"
                          className={`transition-colors ${copiedEmail === selectedContact.email ? 'text-emerald-500' : 'text-gray-400 opacity-0 group-hover:opacity-100 hover:text-gray-600'}`}>
                          <ClipboardDocumentIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {selectedContact.company && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">Company</label>
                        <p className="mt-1">{selectedContact.company}</p>
                      </div>
                    )}
                    {selectedContact.project_type && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">Project Type</label>
                        <p className="mt-1">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getProjectTypeColor(selectedContact.project_type)}`}>
                            {selectedContact.project_type}
                          </span>
                        </p>
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-medium text-gray-600">Submitted</label>
                      <p className="mt-1">{formatDate(selectedContact.submitted_at)}</p>
                    </div>
                    {prefs.showGeoInfo && (selectedContact.ip_address || selectedContact.country) && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">IP / Location</label>
                        {(() => {
                          const ip = selectedContact.ip_address;
                          const priv = ip ? isPrivateIp(ip) : false;
                          return (
                            <>
                              <div className="mt-1 flex items-center gap-1.5">
                                {selectedContact.country && !priv && (
                                  <span title={selectedContact.country_name ?? selectedContact.country} className="text-base">
                                    {countryFlag(selectedContact.country)}
                                  </span>
                                )}
                                {ip && (
                                  <span className="font-mono text-sm">{ip}</span>
                                )}
                                {priv && (
                                  <span className="text-xs text-gray-400 italic">private</span>
                                )}
                              </div>
                              {!priv && selectedContact.country && (
                                <p className="mt-0.5 text-xs text-gray-500">
                                  {[selectedContact.city, selectedContact.region, selectedContact.country_name]
                                    .filter(Boolean).join(', ')}
                                </p>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600">Message</label>
                    <div className="mt-2 p-4 bg-gray-50 rounded-lg">
                      <p className="whitespace-pre-wrap">{selectedContact.message}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" onClick={() => { setSelectedContact(null); setEditMode(false); }}>
                      Close
                    </Button>
                  </div>
                  </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}