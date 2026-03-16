'use client';

import { useState } from 'react';
import { emailTestApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { PaperAirplaneIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

type ProjectType = 'web' | 'mobile' | 'erp' | 'consulting' | 'other';

interface TestEmailPanelProps {
  onEmailSent: () => void;
}

const DEFAULT_TEST_DATA = {
  test_email: '',
  name: 'John Doe',
  company: 'Test Company',
  project_type: 'web' as ProjectType,
  message: 'This is a test message from the admin dashboard to verify email functionality is working correctly.',
};

export default function TestEmailPanel({ onEmailSent }: TestEmailPanelProps) {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [data, setData] = useState(DEFAULT_TEST_DATA);

  const handleTestEmail = async () => {
    if (!data.test_email) {
      setResult({ success: false, message: 'Please enter a test email address' });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await emailTestApi.testContact(data);
      setResult({
        success: res.success,
        message: res.success
          ? `Test email sent successfully! ${res.data.email_sent ? 'Email delivered.' : 'Email queued.'} Test entry ID: ${res.data.id}`
          : res.error?.message || 'Failed to send test email'
      });
      onEmailSent();
    } catch (error) {
      const err = error as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setResult({
        success: false,
        message: err.response?.data?.error?.message ?? err.message ?? 'Failed to send test email'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <CardTitle className="flex items-center gap-2">
          <PaperAirplaneIcon className="h-5 w-5 text-blue-600" />
          Test Contact Email
        </CardTitle>
        <ChevronDownIcon className={`h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200 ${show ? 'rotate-180' : ''}`} />
      </button>
      {show && (
        <CardContent className="space-y-4 border-t border-gray-100 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Test Email Address *</label>
              <Input
                type="email"
                value={data.test_email}
                onChange={(e) => setData(prev => ({ ...prev, test_email: e.target.value }))}
                placeholder="your.email@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Test Name</label>
              <Input
                value={data.name}
                onChange={(e) => setData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Test Company</label>
              <Input
                value={data.company}
                onChange={(e) => setData(prev => ({ ...prev, company: e.target.value }))}
                placeholder="Test Company"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Project Type</label>
              <select
                value={data.project_type}
                onChange={(e) => setData(prev => ({ ...prev, project_type: e.target.value as ProjectType }))}
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Test Message</label>
            <textarea
              value={data.message}
              onChange={(e) => setData(prev => ({ ...prev, message: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Test message content..."
            />
          </div>

          {result && (
            <div className={`p-3 rounded-md ${result.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              {result.message}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={() => void handleTestEmail()}
              disabled={loading || !data.test_email}
              className="flex items-center gap-2"
            >
              <PaperAirplaneIcon className="h-4 w-4" />
              {loading ? 'Sending...' : 'Send Test Email'}
            </Button>
            <Button
              variant="outline"
              onClick={() => { setData(DEFAULT_TEST_DATA); setResult(null); }}
            >
              Reset Form
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
