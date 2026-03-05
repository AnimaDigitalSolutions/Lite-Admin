'use client';

import { useState, useEffect, useCallback } from 'react';
import ProtectedLayout from '@/components/protected-layout';
import { submissionsApi, emailTestApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Search, 
  Trash2, 
  Eye, 
  Download, 
  Calendar,
  Mail,
  Building,
  X,
  Send,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

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
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20;

  // Test email states
  const [showTestEmail, setShowTestEmail] = useState(false);
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testEmailData, setTestEmailData] = useState({
    test_email: '',
    name: 'John Doe',
    company: 'Test Company',
    project_type: 'web' as const,
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
    } catch (error) {
      console.error('Failed to load contacts:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contact submission?')) return;
    
    try {
      await submissionsApi.delete(id);
      setContacts(prev => prev.filter(contact => contact.id !== id));
    } catch (error) {
      console.error('Failed to delete contact:', error);
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
          `"${new Date(contact.submitted_at).toLocaleDateString()}"`,
          `"${contact.ip_address || ''}"`
        ].join(','))
      ].join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `contacts-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } catch (error) {
      console.error('Failed to export CSV:', error);
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
      loadContacts();
    } catch (error: any) {
      setTestEmailResult({
        success: false,
        message: error.response?.data?.error?.message || error.message || 'Failed to send test email'
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Contact Submissions</h1>
            <p className="mt-2 text-gray-600">Manage customer inquiries and contact form submissions</p>
          </div>
          <Button onClick={handleExportCSV} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Search */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
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
                <Mail className="h-8 w-8 text-blue-600" />
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
                <Calendar className="h-8 w-8 text-green-600" />
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
                <Building className="h-8 w-8 text-purple-600" />
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
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-blue-600" />
                Test Contact Email
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTestEmail(!showTestEmail)}
              >
                {showTestEmail ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
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
                    onChange={(e) => setTestEmailData(prev => ({ ...prev, project_type: e.target.value as any }))}
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
                  <Send className="h-4 w-4" />
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
                    <thead>
                      <tr className="border-b">
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
                        <tr key={contact.id} className="border-b hover:bg-gray-50">
                          <td className="p-3">
                            <div className="font-medium">{contact.name}</div>
                          </td>
                          <td className="p-3">
                            <a 
                              href={`mailto:${contact.email}`}
                              className="text-blue-600 hover:underline"
                            >
                              {contact.email}
                            </a>
                          </td>
                          <td className="p-3">
                            {contact.company ? (
                              <span className="text-gray-900">{contact.company}</span>
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
                            {formatDate(contact.submitted_at)}
                          </td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedContact(contact)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDelete(contact.id)}
                              >
                                <Trash2 className="h-4 w-4" />
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

        {/* Contact Detail Modal */}
        {selectedContact && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold">Contact Details</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedContact(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Name</label>
                      <p className="mt-1 text-lg">{selectedContact.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Email</label>
                      <p className="mt-1">
                        <a 
                          href={`mailto:${selectedContact.email}`}
                          className="text-blue-600 hover:underline"
                        >
                          {selectedContact.email}
                        </a>
                      </p>
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
                    {selectedContact.ip_address && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">IP Address</label>
                        <p className="mt-1 font-mono text-sm">{selectedContact.ip_address}</p>
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
                    <Button 
                      onClick={() => window.open(`mailto:${selectedContact.email}`, '_blank')}
                      className="flex items-center gap-2"
                    >
                      <Mail className="h-4 w-4" />
                      Reply via Email
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setSelectedContact(null)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}