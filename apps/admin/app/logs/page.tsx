'use client';

import { useState, useEffect, useCallback } from 'react';
import ProtectedLayout from '@/components/protected-layout';
import { PageHeader } from '@/components/page-header';
import { logsApi } from '@/lib/api';
import { useTimezone } from '@/lib/timezone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  TrashIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

interface LogEntry {
  id: number;
  action: string;
  resource: string;
  resource_id?: number;
  details?: string;
  ip_address?: string;
  created_at: string;
}

const PAGE_SIZE = 50;

const SNEAKY_MESSAGES = [
  'You sneaky wish has been executed.',
  'You are being sneaky — but that\'s OK.',
  'Evidence destroyed. We saw nothing.',
  'Logs? What logs? Never heard of \'em.',
  'The past is gone. Breathe easy.',
  'Shredded. The witnesses have been taken care of.',
];

function getSneakyMessage() {
  return SNEAKY_MESSAGES[Math.floor(Math.random() * SNEAKY_MESSAGES.length)]!;
}

const actionColor: Record<string, string> = {
  media_upload: 'bg-blue-100 text-blue-700',
  media_delete: 'bg-red-100 text-red-700',
  media_update: 'bg-yellow-100 text-yellow-700',
  settings_update: 'bg-purple-100 text-purple-700',
  database_migration: 'bg-gray-100 text-gray-700',
  email_test_contact: 'bg-green-100 text-green-700',
  email_test_waitlist: 'bg-green-100 text-green-700',
  contact_delete: 'bg-red-100 text-red-700',
};

export default function LogsPage() {
  const { formatDate } = useTimezone();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadLogs = useCallback(async (pageIndex: number) => {
    setLoading(true);
    try {
      const response = await logsApi.list({ limit: PAGE_SIZE, offset: pageIndex * PAGE_SIZE });
      setLogs(response.data);
      setTotal(response.pagination.total);
    } catch {
      showToast('Failed to load logs. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadLogs(page);
  }, [page, loadLogs]);

  const handleDeleteOne = async (id: number) => {
    setDeletingId(id);
    try {
      await logsApi.deleteOne(id);
      setLogs(prev => prev.filter(l => l.id !== id));
      setTotal(prev => prev - 1);
      showToast(getSneakyMessage());
    } catch {
      showToast('Failed to delete log entry.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Delete every single log entry? This cannot be undone.')) return;
    setClearingAll(true);
    try {
      await logsApi.deleteAll();
      setLogs([]);
      setTotal(0);
      setPage(0);
      showToast('All logs incinerated. Clean slate achieved.');
    } catch {
      showToast('Failed to clear logs.');
    } finally {
      setClearingAll(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Activity Log"
          description={
            <>
              All admin actions recorded in the system
              {total > 0 && <span className="ml-2 text-muted-foreground/50">({total} total)</span>}
            </>
          }
        >
          {total > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleClearAll()}
              disabled={clearingAll}
              className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
            >
              <XCircleIcon className="mr-1.5 h-4 w-4" />
              {clearingAll ? 'Clearing…' : 'Clear all'}
            </Button>
          )}
        </PageHeader>

        {/* Toast */}
        {toast && (
          <div className="rounded-lg border border-border bg-gray-900 px-4 py-3 text-sm text-white shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
            {toast}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Recent Actions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 text-center text-muted-foreground">Loading logs...</div>
            ) : logs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No activity recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Resource</th>
                      <th className="px-4 py-3">Details</th>
                      <th className="px-4 py-3">IP</th>
                      <th className="px-4 py-3 whitespace-nowrap">Time</th>
                      <th className="px-4 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {logs.map((log) => (
                      <tr
                        key={log.id}
                        className={`transition-all hover:bg-accent ${
                          deletingId === log.id ? 'opacity-40 pointer-events-none' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              actionColor[log.action] ?? 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {log.action.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {log.resource}
                          {log.resource_id != null && (
                            <span className="ml-1 text-muted-foreground">#{log.resource_id}</span>
                          )}
                        </td>
                        <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">
                          {log.details ?? '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {log.ip_address ?? '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {formatDate(log.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => void handleDeleteOne(log.id)}
                            disabled={deletingId === log.id}
                            className="rounded p-1 text-muted-foreground/50 hover:bg-red-50 hover:text-red-500 transition-colors"
                            title="Delete this entry"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <span className="text-sm text-muted-foreground">
                  Page {page + 1} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedLayout>
  );
}
