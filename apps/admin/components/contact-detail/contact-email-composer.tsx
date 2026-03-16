'use client';

import { useState, useEffect } from 'react';
import { submissionsApi, credentialsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  XMarkIcon,
  PaperAirplaneIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface ContactEmailComposerProps {
  contactId: string;
  contactName: string;
  contactEmail: string;
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}

export default function ContactEmailComposer({ contactId, contactName, contactEmail, open, onClose, onSent }: ContactEmailComposerProps) {
  const [composeStep, setComposeStep] = useState<'write' | 'preview' | 'confirm'>('write');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState<{ success: boolean; message: string } | null>(null);
  const [fromAddress, setFromAddress] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    setComposeStep('write');
    setEmailSubject('');
    setEmailBody('');
    setEmailResult(null);
    if (!fromAddress) {
      void credentialsApi.get().then((res) => {
        const email = res.data?.email;
        if (email?.from_address) {
          const display = email.display_name ? `${email.display_name} <${email.from_address}>` : email.from_address;
          setFromAddress(display);
        }
      }).catch(() => { /* ignore */ });
    }
  }, [open, fromAddress]);

  if (!open) return null;

  const handleSendEmail = async () => {
    setSendingEmail(true);
    setEmailResult(null);
    try {
      await submissionsApi.sendEmail(contactId, emailSubject, emailBody);
      setEmailResult({ success: true, message: `Email sent to ${contactEmail}` });
      setComposeStep('write');
      setEmailSubject('');
      setEmailBody('');
      onSent();
      setTimeout(() => {
        onClose();
        setEmailResult(null);
      }, 2000);
    } catch (err) {
      const e = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setEmailResult({
        success: false,
        message: e.response?.data?.error?.message ?? e.message ?? 'Failed to send email',
      });
      setComposeStep('write');
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]" onClick={(e) => e.stopPropagation()}>
      <div className="bg-white rounded-lg max-w-lg w-full shadow-xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <PaperAirplaneIcon className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold">
              {composeStep === 'confirm' ? 'Confirm Send' : composeStep === 'preview' ? 'Preview Email' : 'Compose Email'}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {fromAddress && (
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">From</label>
              <div className="px-3 py-2 bg-muted rounded-md text-sm border border-border text-muted-foreground">{fromAddress}</div>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">To</label>
            <div className="px-3 py-2 bg-muted rounded-md text-sm border border-border">
              {contactName} &lt;{contactEmail}&gt;
            </div>
          </div>

          {emailResult && (
            <div className={`p-3 rounded-md text-sm ${emailResult.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              {emailResult.message}
            </div>
          )}

          {composeStep === 'write' && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Subject *</label>
                <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Email subject..." />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Message *</label>
                <textarea
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  placeholder="Write your message..."
                  rows={8}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">Plain text — line breaks will be preserved.</p>
              </div>
            </>
          )}

          {composeStep === 'preview' && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Subject</label>
                <div className="px-3 py-2 bg-muted rounded-md text-sm border border-border font-medium">{emailSubject}</div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Message Preview</label>
                <div className="px-3 py-3 bg-muted rounded-md text-sm border border-border whitespace-pre-wrap min-h-[100px]">{emailBody}</div>
              </div>
            </>
          )}

          {composeStep === 'confirm' && (
            <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <ExclamationTriangleIcon className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">You are about to send a real email</p>
                  <p className="text-sm text-amber-700 mt-1">
                    This will send an email to <span className="font-medium">{contactEmail}</span> with
                    subject &quot;<span className="font-medium">{emailSubject}</span>&quot;.
                  </p>
                  <p className="text-sm text-amber-700 mt-1">This action cannot be undone.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t bg-muted rounded-b-lg">
          <div>
            {composeStep !== 'write' && (
              <Button variant="ghost" size="sm" onClick={() => setComposeStep(composeStep === 'confirm' ? 'preview' : 'write')} disabled={sendingEmail}>
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={sendingEmail}>Cancel</Button>
            {composeStep === 'write' && (
              <Button onClick={() => setComposeStep('preview')} disabled={!emailSubject.trim() || !emailBody.trim()}>Preview</Button>
            )}
            {composeStep === 'preview' && (
              <Button onClick={() => setComposeStep('confirm')}>Continue to Send</Button>
            )}
            {composeStep === 'confirm' && (
              <Button onClick={() => void handleSendEmail()} disabled={sendingEmail} className="bg-red-600 hover:bg-red-700 text-white">
                <PaperAirplaneIcon className="h-4 w-4 mr-1" />
                {sendingEmail ? 'Sending…' : 'Send Email'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
