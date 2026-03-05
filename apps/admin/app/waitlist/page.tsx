'use client';

import { useState, useEffect, useCallback } from 'react';
import ProtectedLayout from '@/components/protected-layout';
import { waitlistApi, emailTestApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Search, 
  Trash2, 
  Download, 
  Calendar,
  Users,
  TrendingUp,
  Mail,
  Send,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface WaitlistEntry {
  id: string;
  email: string;
  name?: string;
  signed_up_at: string;
  ip_address?: string;
}

export default function WaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20;

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
    } catch (error) {
      console.error('Failed to load waitlist entries:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleExportCSV = async () => {
    try {
      const blob = await waitlistApi.export();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `waitlist-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export waitlist:', error);
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
    
    if (!confirm(`Are you sure you want to delete ${selectedEntries.size} waitlist entries?`)) return;
    
    // Note: This would require a bulk delete API endpoint
    // For now, we'll show what the UI would look like
    console.log('Bulk delete:', Array.from(selectedEntries));
    
    // Remove from local state for demo
    setEntries(prev => prev.filter(entry => !selectedEntries.has(entry.id)));
    setSelectedEntries(new Set());
  };

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
      loadEntries();
    } catch (error: any) {
      setTestEmailResult({
        success: false,
        message: error.response?.data?.error?.message || error.message || 'Failed to send test email'
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
                <Trash2 className="h-4 w-4" />
                Delete ({selectedEntries.size})
              </Button>
            )}
            <Button onClick={handleExportCSV} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
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
                <Users className="h-8 w-8 text-blue-600" />
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
                <Calendar className="h-8 w-8 text-green-600" />
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
                <TrendingUp className="h-8 w-8 text-purple-600" />
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
                <Mail className="h-8 w-8 text-orange-600" />
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
                <Send className="h-5 w-5 text-blue-600" />
                Test Waitlist Email
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
                  <Send className="h-4 w-4" />
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
                        <tr key={entry.id} className="border-b hover:bg-gray-50">
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={selectedEntries.has(entry.id)}
                              onChange={(e) => handleSelectEntry(entry.id, e.target.checked)}
                              className="rounded"
                            />
                          </td>
                          <td className="p-3">
                            {entry.name ? (
                              <span className="font-medium">{entry.name}</span>
                            ) : (
                              <span className="text-gray-400 italic">No name</span>
                            )}
                          </td>
                          <td className="p-3">
                            <a 
                              href={`mailto:${entry.email}`}
                              className="text-blue-600 hover:underline"
                            >
                              {entry.email}
                            </a>
                          </td>
                          <td className="p-3 text-sm text-gray-600">
                            {formatDate(entry.signed_up_at)}
                          </td>
                          <td className="p-3">
                            {entry.ip_address ? (
                              <span className="font-mono text-xs text-gray-600">{entry.ip_address}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setSelectedEntries(new Set([entry.id]));
                                handleBulkDelete();
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                variant="outline"
                className="flex items-center justify-center gap-2 h-20"
                onClick={() => {
                  const emails = entries.map(e => e.email).join(',');
                  window.open(`mailto:?bcc=${emails}`, '_blank');
                }}
              >
                <Mail className="h-6 w-6" />
                <div className="text-center">
                  <div className="font-medium">Email All</div>
                  <div className="text-xs text-gray-500">Send BCC email</div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="flex items-center justify-center gap-2 h-20"
                onClick={handleExportCSV}
              >
                <Download className="h-6 w-6" />
                <div className="text-center">
                  <div className="font-medium">Export CSV</div>
                  <div className="text-xs text-gray-500">Download all data</div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="flex items-center justify-center gap-2 h-20"
                onClick={() => {
                  const recentEntries = entries.filter(e => {
                    const sevenDaysAgo = new Date();
                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                    return new Date(e.signed_up_at) > sevenDaysAgo;
                  });
                  const emails = recentEntries.map(e => e.email).join(',');
                  window.open(`mailto:?bcc=${emails}`, '_blank');
                }}
              >
                <TrendingUp className="h-6 w-6" />
                <div className="text-center">
                  <div className="font-medium">Email Recent</div>
                  <div className="text-xs text-gray-500">Last 7 days only</div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedLayout>
  );
}