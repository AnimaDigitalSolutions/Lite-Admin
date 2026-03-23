'use client';

import { useState, useEffect, useMemo } from 'react';
import ProtectedLayout from '@/components/protected-layout';
import { composeApi, submissionsApi, credentialsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  PaperAirplaneIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import type { Recipient, Contact } from './types';
import { avatarColor } from './types';
import RecipientField from './components/recipient-field';
import ContactPickerModal from './components/contact-picker-modal';

export default function ComposePage() {
  const [toRecipients, setToRecipients] = useState<Recipient[]>([]);
  const [ccRecipients, setCcRecipients] = useState<Recipient[]>([]);
  const [bccRecipients, setBccRecipients] = useState<Recipient[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [step, setStep] = useState<'write' | 'preview' | 'confirm'>('write');

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [fromAddress, setFromAddress] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [addToContactEmails, setAddToContactEmails] = useState<Set<string>>(new Set());

  // Contact picker modal state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'to' | 'cc' | 'bcc'>('to');

  // Load all contacts on mount (paginated, deduplicated by email)
  useEffect(() => {
    const load = async () => {
      try {
        const all: Contact[] = [];
        let offset = 0;
        const limit = 100;
        while (true) {
          const res = await submissionsApi.list({ limit, offset });
          const page = res.data || [];
          all.push(...page);
          if (page.length < limit) break;
          offset += limit;
        }
        // Deduplicate by email — keep the most recent entry (first in list)
        const seen = new Map<string, Contact>();
        for (const c of all) {
          const key = c.email.toLowerCase();
          if (!seen.has(key)) seen.set(key, c);
        }
        setContacts([...seen.values()]);
      } catch {
        // contacts unavailable
      } finally {
        setContactsLoading(false);
      }
    };
    void load();
  }, []);

  // Load from address
  useEffect(() => {
    const load = async () => {
      try {
        const res = await credentialsApi.get();
        const email = res.data?.email;
        if (email?.display_name && email?.from_address) {
          setFromAddress(`${email.display_name} <${email.from_address}>`);
        } else if (email?.from_address) {
          setFromAddress(email.from_address);
        }
      } catch { /* ignore */ }
    };
    void load();
  }, []);

  const openPicker = (target: 'to' | 'cc' | 'bcc') => {
    setPickerTarget(target);
    setPickerOpen(true);
  };

  const getRecipientsForTarget = (target: 'to' | 'cc' | 'bcc') => {
    if (target === 'cc') return ccRecipients;
    if (target === 'bcc') return bccRecipients;
    return toRecipients;
  };
  const setRecipientsForTarget = (target: 'to' | 'cc' | 'bcc', r: Recipient[]) => {
    if (target === 'cc') setCcRecipients(r);
    else if (target === 'bcc') setBccRecipients(r);
    else setToRecipients(r);
  };

  // All currently used emails across all fields
  const allUsedEmails = useMemo(() => {
    const s = new Set<string>();
    for (const r of [...toRecipients, ...ccRecipients, ...bccRecipients]) {
      s.add(r.email.toLowerCase());
    }
    return s;
  }, [toRecipients, ccRecipients, bccRecipients]);

  const handleSend = async () => {
    setSending(true);
    setResult(null);
    try {
      await composeApi.send({
        to: toRecipients,
        cc: ccRecipients.length ? ccRecipients : undefined,
        bcc: bccRecipients.length ? bccRecipients : undefined,
        subject,
        body,
      });

      // Auto-add new contacts if user opted in
      for (const email of addToContactEmails) {
        const r = [...toRecipients, ...ccRecipients, ...bccRecipients].find(
          rec => rec.email === email && !rec.isContact,
        );
        if (r) {
          try {
            await submissionsApi.create({
              name: r.name || r.email.split('@')[0],
              email: r.email,
              message: 'Added from Compose page',
            });
          } catch { /* contact may already exist */ }
        }
      }

      setResult({ success: true, message: 'Email sent successfully!' });
      setToRecipients([]); setCcRecipients([]); setBccRecipients([]);
      setSubject(''); setBody(''); setStep('write');
      setShowCc(false); setShowBcc(false); setAddToContactEmails(new Set());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send email';
      setResult({ success: false, message: msg });
      setStep('write');
    } finally {
      setSending(false);
    }
  };

  const canPreview = toRecipients.length > 0 && subject.trim() && body.trim();

  const nonContactToRecipients = [...toRecipients, ...ccRecipients, ...bccRecipients].filter(
    r => !r.isContact && !contacts.some(c => c.email.toLowerCase() === r.email.toLowerCase()),
  );

  return (
    <ProtectedLayout>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <PencilSquareIcon className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Compose Email</h1>
            <p className="text-sm text-muted-foreground">Send an email to one or more recipients</p>
          </div>
        </div>

        {result && (
          <div className={`mb-4 p-3 rounded-md text-sm ${
            result.success
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {result.message}
          </div>
        )}

        <Card>
          <CardContent className="p-6 space-y-4">
            {/* Step header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PaperAirplaneIcon className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold">
                  {step === 'confirm' ? 'Confirm Send' : step === 'preview' ? 'Preview Email' : 'Compose'}
                </h3>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className={step === 'write' ? 'text-foreground font-medium' : ''}>Write</span>
                <span>&rarr;</span>
                <span className={step === 'preview' ? 'text-foreground font-medium' : ''}>Preview</span>
                <span>&rarr;</span>
                <span className={step === 'confirm' ? 'text-foreground font-medium' : ''}>Send</span>
              </div>
            </div>

            {/* From field */}
            {fromAddress && (
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">From</label>
                <div className="px-3 py-2 bg-muted rounded-md text-sm border border-border text-muted-foreground">
                  {fromAddress}
                </div>
              </div>
            )}

            {/* === WRITE STEP === */}
            {step === 'write' && (
              <>
                {/* TO */}
                <RecipientField
                  label="To"
                  recipients={toRecipients}
                  setRecipients={setToRecipients}
                  contacts={contacts}
                  allUsedEmails={allUsedEmails}
                  onOpenPicker={() => openPicker('to')}
                  required
                />

                {/* CC / BCC toggles */}
                {(!showCc || !showBcc) && (
                  <div className="flex gap-3 text-xs">
                    {!showCc && (
                      <button type="button" onClick={() => setShowCc(true)} className="text-blue-600 hover:text-blue-800 font-medium">
                        + CC
                      </button>
                    )}
                    {!showBcc && (
                      <button type="button" onClick={() => setShowBcc(true)} className="text-blue-600 hover:text-blue-800 font-medium">
                        + BCC
                      </button>
                    )}
                  </div>
                )}

                {showCc && (
                  <RecipientField
                    label="CC"
                    recipients={ccRecipients}
                    setRecipients={setCcRecipients}
                    contacts={contacts}
                    allUsedEmails={allUsedEmails}
                    onOpenPicker={() => openPicker('cc')}
                    onCollapse={() => { setShowCc(false); setCcRecipients([]); }}
                  />
                )}

                {showBcc && (
                  <RecipientField
                    label="BCC"
                    recipients={bccRecipients}
                    setRecipients={setBccRecipients}
                    contacts={contacts}
                    allUsedEmails={allUsedEmails}
                    onOpenPicker={() => openPicker('bcc')}
                    onCollapse={() => { setShowBcc(false); setBccRecipients([]); }}
                  />
                )}

                {/* Subject */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Subject *</label>
                  <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject..." />
                </div>

                {/* Body */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Message *</label>
                  <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder="Write your message..."
                    rows={10}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Plain text — line breaks will be preserved.</p>
                </div>

                {/* Suggest adding non-contact recipients */}
                {nonContactToRecipients.length > 0 && (
                  <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                    <div className="flex items-start gap-2">
                      <UserPlusIcon className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                      <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">Add new recipients to Contacts?</p>
                        {nonContactToRecipients.map(r => (
                          <label key={r.email} className="flex items-center gap-2 py-0.5">
                            <input
                              type="checkbox"
                              checked={addToContactEmails.has(r.email)}
                              onChange={() => {
                                setAddToContactEmails(prev => {
                                  const next = new Set(prev);
                                  if (next.has(r.email)) next.delete(r.email); else next.add(r.email);
                                  return next;
                                });
                              }}
                              className="h-3.5 w-3.5 rounded border-blue-300 text-blue-600"
                            />
                            <span>{r.name ? `${r.name} <${r.email}>` : r.email}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* === PREVIEW STEP === */}
            {step === 'preview' && (
              <>
                <RecipientPreview label="To" recipients={toRecipients} />
                {ccRecipients.length > 0 && <RecipientPreview label="CC" recipients={ccRecipients} />}
                {bccRecipients.length > 0 && <RecipientPreview label="BCC" recipients={bccRecipients} />}
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Subject</label>
                  <div className="px-3 py-2 bg-muted rounded-md text-sm border border-border font-medium">{subject}</div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Message Preview</label>
                  <div className="px-3 py-3 bg-muted rounded-md text-sm border border-border whitespace-pre-wrap min-h-[100px]">{body}</div>
                </div>
              </>
            )}

            {/* === CONFIRM STEP === */}
            {step === 'confirm' && (
              <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <ExclamationTriangleIcon className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">You are about to send a real email</p>
                    <p className="text-sm text-amber-700 mt-1"><strong>To:</strong> {toRecipients.map(r => r.name || r.email).join(', ')}</p>
                    {ccRecipients.length > 0 && <p className="text-sm text-amber-700"><strong>CC:</strong> {ccRecipients.map(r => r.name || r.email).join(', ')}</p>}
                    {bccRecipients.length > 0 && <p className="text-sm text-amber-700"><strong>BCC:</strong> {bccRecipients.map(r => r.name || r.email).join(', ')}</p>}
                    <p className="text-sm text-amber-700"><strong>Subject:</strong> &quot;{subject}&quot;</p>
                    <p className="text-sm text-amber-700 mt-2">This action cannot be undone.</p>
                    {addToContactEmails.size > 0 && (
                      <p className="text-sm text-amber-700 mt-1">
                        {addToContactEmails.size} new recipient(s) will be added to your Contacts after sending.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div>
                {step !== 'write' && (
                  <Button variant="ghost" size="sm" onClick={() => setStep(step === 'confirm' ? 'preview' : 'write')} disabled={sending}>
                    Back
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {step === 'write' && <Button onClick={() => setStep('preview')} disabled={!canPreview}>Preview</Button>}
                {step === 'preview' && <Button onClick={() => setStep('confirm')}>Continue to Send</Button>}
                {step === 'confirm' && (
                  <Button onClick={() => void handleSend()} disabled={sending} className="bg-red-600 hover:bg-red-700 text-white">
                    {sending ? 'Sending...' : 'Send Email'}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contact Picker Modal */}
      {pickerOpen && (
        <ContactPickerModal
          contacts={contacts}
          loading={contactsLoading}
          currentRecipients={getRecipientsForTarget(pickerTarget)}
          allUsedEmails={allUsedEmails}
          targetField={pickerTarget}
          onConfirm={(selected) => {
            setRecipientsForTarget(pickerTarget, selected);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </ProtectedLayout>
  );
}

function RecipientPreview({ label, recipients }: { label: string; recipients: Recipient[] }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
      <div className="flex flex-wrap gap-1.5 px-3 py-2 bg-muted rounded-md border border-border">
        {recipients.map(r => (
          <span key={r.email} className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-0.5 text-xs font-medium bg-card border border-border">
            <span className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold text-white shrink-0 ${avatarColor(r.name || r.email)}`}>
              {(r.name || r.email).charAt(0).toUpperCase()}
            </span>
            <span>{r.name || r.email}</span>
            <span className="text-muted-foreground text-[10px]">{r.email}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

