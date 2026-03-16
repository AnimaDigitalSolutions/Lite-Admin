'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { emailTestApi } from '@/lib/api';
import {
  PaperAirplaneIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';

interface TestEmailPanelProps {
  onEmailSent: () => void;
}

export default function TestEmailPanel({ onEmailSent }: TestEmailPanelProps) {
  const [showTestEmail, setShowTestEmail] = useState(false);
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testEmailData, setTestEmailData] = useState({
    test_email: '',
    name: 'Jane Smith'
  });

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
      onEmailSent();
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

  return (
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
  );
}
