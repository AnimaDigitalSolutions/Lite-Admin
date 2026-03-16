'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import ProtectedLayout from '@/components/protected-layout';
import { composeApi, submissionsApi, credentialsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  PaperAirplaneIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  UserPlusIcon,
  UsersIcon,
  MagnifyingGlassIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

interface Recipient {
  email: string;
  name?: string;
  isContact?: boolean;
}

interface Contact {
  id: number;
  name: string;
  email: string;
  company?: string;
}

// Stable color palette for initials avatars based on name
const AVATAR_COLORS = [
  'bg-blue-600', 'bg-emerald-600', 'bg-violet-600', 'bg-amber-600',
  'bg-rose-600', 'bg-cyan-600', 'bg-indigo-600', 'bg-teal-600',
  'bg-pink-600', 'bg-orange-600',
];
function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

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
        // eslint-disable-next-line no-constant-condition
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
          <PencilSquareIcon className="h-6 w-6 text-gray-400" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Compose Email</h1>
            <p className="text-sm text-gray-500">Send an email to one or more recipients</p>
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
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <span className={step === 'write' ? 'text-gray-900 font-medium' : ''}>Write</span>
                <span>&rarr;</span>
                <span className={step === 'preview' ? 'text-gray-900 font-medium' : ''}>Preview</span>
                <span>&rarr;</span>
                <span className={step === 'confirm' ? 'text-gray-900 font-medium' : ''}>Send</span>
              </div>
            </div>

            {/* From field */}
            {fromAddress && (
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">From</label>
                <div className="px-3 py-2 bg-gray-50 rounded-md text-sm border border-gray-200 text-gray-600">
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
                  <label className="text-xs font-medium text-gray-500 block mb-1">Subject *</label>
                  <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject..." />
                </div>

                {/* Body */}
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Message *</label>
                  <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder="Write your message..."
                    rows={10}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">Plain text — line breaks will be preserved.</p>
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
                  <label className="text-xs font-medium text-gray-500 block mb-1">Subject</label>
                  <div className="px-3 py-2 bg-gray-50 rounded-md text-sm border border-gray-200 font-medium">{subject}</div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Message Preview</label>
                  <div className="px-3 py-3 bg-gray-50 rounded-md text-sm border border-gray-200 whitespace-pre-wrap min-h-[100px]">{body}</div>
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

// ---- Preview row for recipients ----

function RecipientPreview({ label, recipients }: { label: string; recipients: Recipient[] }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 block mb-1">{label}</label>
      <div className="flex flex-wrap gap-1.5 px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
        {recipients.map(r => (
          <span key={r.email} className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-0.5 text-xs font-medium bg-white border border-gray-200">
            <span className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold text-white shrink-0 ${avatarColor(r.name || r.email)}`}>
              {(r.name || r.email).charAt(0).toUpperCase()}
            </span>
            <span>{r.name || r.email}</span>
            <span className="text-gray-400 text-[10px]">{r.email}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ---- Inline recipient field with quick search + picker button ----

function RecipientField({
  label,
  recipients,
  setRecipients,
  contacts,
  allUsedEmails,
  onOpenPicker,
  required,
  onCollapse,
}: {
  label: string;
  recipients: Recipient[];
  setRecipients: (r: Recipient[]) => void;
  contacts: Contact[];
  allUsedEmails: Set<string>;
  onOpenPicker: () => void;
  required?: boolean;
  onCollapse?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValidEmail = emailRegex.test(query.trim());

  const addedEmails = useMemo(() => new Set(recipients.map(r => r.email.toLowerCase())), [recipients]);

  const filteredContacts = useMemo(() => {
    const available = contacts.filter(c => !allUsedEmails.has(c.email.toLowerCase()));
    if (!query.trim()) return available.slice(0, 6);
    const q = query.toLowerCase();
    return available
      .filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.company && c.company.toLowerCase().includes(q)))
      .slice(0, 6);
  }, [query, contacts, allUsedEmails]);

  const options: { type: 'contact' | 'raw'; contact?: Contact; email?: string }[] = filteredContacts.map(c => ({
    type: 'contact' as const, contact: c,
  }));

  if (isValidEmail && !addedEmails.has(query.trim().toLowerCase())) {
    if (!filteredContacts.some(c => c.email.toLowerCase() === query.trim().toLowerCase())) {
      options.push({ type: 'raw', email: query.trim() });
    }
  }

  const addRecipient = (r: Recipient) => {
    if (!addedEmails.has(r.email.toLowerCase())) {
      setRecipients([...recipients, r]);
    }
    setQuery(''); setShowDropdown(false); setHighlightIndex(0);
    inputRef.current?.focus();
  };

  const removeRecipient = (email: string) => {
    setRecipients(recipients.filter(r => r.email !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !query && recipients.length > 0) {
      removeRecipient(recipients[recipients.length - 1].email);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (options.length > 0 && showDropdown) {
        const opt = options[highlightIndex] || options[0];
        if (opt.type === 'contact' && opt.contact) addRecipient({ email: opt.contact.email, name: opt.contact.name, isContact: true });
        else if (opt.type === 'raw' && opt.email) addRecipient({ email: opt.email });
      } else if (isValidEmail) {
        addRecipient({ email: query.trim() });
      }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIndex(i => Math.min(i + 1, options.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIndex(i => Math.max(i - 1, 0)); }
    if (e.key === 'Escape') setShowDropdown(false);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef}>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-gray-500">{label} {required && '*'}</label>
        <div className="flex items-center gap-2">
          {onCollapse && (
            <button type="button" onClick={onCollapse} className="text-xs text-gray-400 hover:text-gray-600">Remove</button>
          )}
        </div>
      </div>
      <div className="flex gap-1.5">
        {/* Chip input area */}
        <div
          className="flex-1 flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 min-h-[38px] cursor-text"
          onClick={() => inputRef.current?.focus()}
        >
          {recipients.map(r => (
            <span
              key={r.email}
              className={`group/chip inline-flex items-center gap-1 rounded-full pl-1 pr-2 py-0.5 text-xs font-medium transition-colors ${
                r.isContact ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-gray-50 text-gray-700 border border-gray-200'
              }`}
              title={r.name ? `${r.name} <${r.email}>` : r.email}
            >
              <span className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold shrink-0 text-white ${avatarColor(r.name || r.email)}`}>
                {(r.name || r.email).charAt(0).toUpperCase()}
              </span>
              <span className="truncate max-w-[120px]">{r.name || r.email}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); removeRecipient(r.email); }}
                className="text-current opacity-40 hover:opacity-100 group-hover/chip:opacity-70 transition-opacity">
                <XMarkIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setShowDropdown(true); setHighlightIndex(0); }}
            onFocus={() => setShowDropdown(true)}
            onKeyDown={handleKeyDown}
            placeholder={recipients.length === 0 ? 'Type a name or email...' : ''}
            className="flex-1 min-w-[140px] bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
        </div>
        {/* Browse contacts button */}
        <button
          type="button"
          onClick={onOpenPicker}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-input bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          title="Browse contacts"
        >
          <UsersIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Browse</span>
        </button>
      </div>

      {/* Quick dropdown */}
      {showDropdown && options.length > 0 && (
        <div className="relative z-10">
          <div className="absolute top-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto py-1">
            {!query.trim() && filteredContacts.length > 0 && (
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Contacts</div>
            )}
            {options.map((opt, i) => (
              <button
                key={opt.type === 'contact' ? opt.contact!.id : opt.email}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (opt.type === 'contact' && opt.contact) addRecipient({ email: opt.contact.email, name: opt.contact.name, isContact: true });
                  else if (opt.type === 'raw' && opt.email) addRecipient({ email: opt.email });
                }}
                onMouseEnter={() => setHighlightIndex(i)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors ${i === highlightIndex ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
              >
                {opt.type === 'contact' ? (
                  <>
                    <span className={`inline-flex items-center justify-center h-8 w-8 rounded-full text-white text-xs font-bold shrink-0 ${avatarColor(opt.contact!.name)}`}>
                      {opt.contact!.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {opt.contact!.name}
                        {opt.contact!.company && <span className="text-gray-400 font-normal ml-1.5 text-xs">({opt.contact!.company})</span>}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{opt.contact!.email}</div>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-gray-200 text-gray-500 text-xs shrink-0">@</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-gray-600">Add <span className="font-medium text-gray-900">{opt.email}</span></div>
                      <div className="text-xs text-gray-400">New email address</div>
                    </div>
                  </>
                )}
              </button>
            ))}
            {contacts.length > filteredContacts.length && (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onOpenPicker(); setShowDropdown(false); }}
                className="w-full text-left px-3 py-2 flex items-center gap-2.5 text-blue-600 hover:bg-blue-50 border-t border-gray-100"
              >
                <UsersIcon className="h-4 w-4" />
                <span className="text-sm font-medium">Browse all {contacts.length} contacts...</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Full-screen Contact Picker Modal ----

function ContactPickerModal({
  contacts,
  loading,
  currentRecipients,
  allUsedEmails,
  targetField,
  onConfirm,
  onClose,
}: {
  contacts: Contact[];
  loading: boolean;
  currentRecipients: Recipient[];
  allUsedEmails: Set<string>;
  targetField: 'to' | 'cc' | 'bcc';
  onConfirm: (recipients: Recipient[]) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number>>(() => {
    const ids = new Set<number>();
    for (const r of currentRecipients) {
      const c = contacts.find(ct => ct.email.toLowerCase() === r.email.toLowerCase());
      if (c) ids.add(c.id);
    }
    return ids;
  });
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { searchRef.current?.focus(); }, []);

  // Filter contacts by search
  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.company && c.company.toLowerCase().includes(q)),
    );
  }, [contacts, search]);

  // Group by company
  const grouped = useMemo(() => {
    const map = new Map<string, Contact[]>();
    for (const c of filtered) {
      const key = c.company?.trim() || 'No Company';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    // Sort groups: companies first (alphabetical), "No Company" last
    const entries = [...map.entries()].sort((a, b) => {
      if (a[0] === 'No Company') return 1;
      if (b[0] === 'No Company') return -1;
      return a[0].localeCompare(b[0]);
    });
    return entries;
  }, [filtered]);

  const toggleContact = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleGroup = (groupContacts: Contact[]) => {
    const availableInGroup = groupContacts.filter(c => !isUsedElsewhere(c));
    const allSelected = availableInGroup.every(c => selected.has(c.id));
    setSelected(prev => {
      const next = new Set(prev);
      for (const c of availableInGroup) {
        if (allSelected) next.delete(c.id); else next.add(c.id);
      }
      return next;
    });
  };

  const toggleCollapseGroup = (group: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group); else next.add(group);
      return next;
    });
  };

  // Check if a contact is already used in another field
  const currentFieldEmails = new Set(currentRecipients.map(r => r.email.toLowerCase()));
  const isUsedElsewhere = (c: Contact) => {
    const email = c.email.toLowerCase();
    return allUsedEmails.has(email) && !currentFieldEmails.has(email);
  };

  const handleConfirm = () => {
    const selectedContacts = contacts.filter(c => selected.has(c.id));
    // Keep any non-contact (raw email) recipients that were already in the field
    const rawRecipients = currentRecipients.filter(r => !r.isContact && !contacts.some(c => c.email.toLowerCase() === r.email.toLowerCase()));
    const newRecipients: Recipient[] = [
      ...selectedContacts.map(c => ({ email: c.email, name: c.name, isContact: true })),
      ...rawRecipients,
    ];
    onConfirm(newRecipients);
  };

  const selectAllFiltered = () => {
    setSelected(prev => {
      const next = new Set(prev);
      for (const c of filtered) {
        if (!isUsedElsewhere(c)) next.add(c.id);
      }
      return next;
    });
  };

  const deselectAllFiltered = () => {
    setSelected(prev => {
      const next = new Set(prev);
      for (const c of filtered) next.delete(c.id);
      return next;
    });
  };

  const allFilteredSelected = filtered.filter(c => !isUsedElsewhere(c)).every(c => selected.has(c.id)) && filtered.length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2.5">
            <UsersIcon className="h-5 w-5 text-blue-600" />
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                Select Contacts
              </h3>
              <p className="text-xs text-gray-500">
                Adding to <span className="font-medium uppercase">{targetField}</span> &middot; {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b shrink-0">
          <div className="relative">
            <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email, or company..."
              className="w-full rounded-md border border-gray-200 bg-gray-50 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400"
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
            <button
              type="button"
              onClick={allFilteredSelected ? deselectAllFiltered : selectAllFiltered}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              {allFilteredSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>
        </div>

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
            </div>
          ) : grouped.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              {search ? 'No contacts match your search.' : 'No contacts found.'}
            </div>
          ) : (
            <div className="py-1">
              {grouped.map(([group, groupContacts]) => {
                const availableInGroup = groupContacts.filter(c => !isUsedElsewhere(c));
                const selectedInGroup = availableInGroup.filter(c => selected.has(c.id)).length;
                const isCollapsed = collapsedGroups.has(group);
                const allGroupSelected = availableInGroup.length > 0 && availableInGroup.every(c => selected.has(c.id));

                return (
                  <div key={group}>
                    {/* Group header */}
                    <div
                      className="sticky top-0 bg-gray-50/95 backdrop-blur-sm flex items-center justify-between px-5 py-1.5 cursor-pointer hover:bg-gray-100/80 transition-colors"
                      onClick={() => toggleCollapseGroup(group)}
                    >
                      <div className="flex items-center gap-2">
                        {isCollapsed
                          ? <ChevronRightIcon className="h-3.5 w-3.5 text-gray-400" />
                          : <ChevronDownIcon className="h-3.5 w-3.5 text-gray-400" />
                        }
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{group}</span>
                        <span className="text-[11px] text-gray-400">
                          {selectedInGroup > 0 && <span className="text-blue-600">{selectedInGroup} selected &middot; </span>}
                          {groupContacts.length}
                        </span>
                      </div>
                      {availableInGroup.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleGroup(groupContacts); }}
                          className="text-[11px] text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {allGroupSelected ? 'Deselect' : 'Select all'}
                        </button>
                      )}
                    </div>

                    {/* Contacts */}
                    {!isCollapsed && groupContacts.map(c => {
                      const isSelected = selected.has(c.id);
                      const usedElsewhere = isUsedElsewhere(c);

                      return (
                        <button
                          key={c.id}
                          type="button"
                          disabled={usedElsewhere}
                          onClick={() => toggleContact(c.id)}
                          className={`w-full text-left flex items-center gap-3 px-5 py-2.5 transition-colors ${
                            usedElsewhere
                              ? 'opacity-40 cursor-not-allowed'
                              : isSelected
                                ? 'bg-blue-50/60 hover:bg-blue-50'
                                : 'hover:bg-gray-50'
                          }`}
                        >
                          {/* Checkbox */}
                          <div className={`shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-blue-600 border-blue-600'
                              : usedElsewhere
                                ? 'border-gray-200 bg-gray-100'
                                : 'border-gray-300 hover:border-blue-400'
                          }`}>
                            {isSelected && <CheckIcon className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                          </div>

                          {/* Avatar */}
                          <span className={`inline-flex items-center justify-center h-9 w-9 rounded-full text-white text-sm font-bold shrink-0 ${avatarColor(c.name)}`}>
                            {c.name.charAt(0).toUpperCase()}
                          </span>

                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 truncate">{c.name}</div>
                            <div className="text-xs text-gray-500 truncate">{c.email}</div>
                          </div>

                          {/* Badge if used elsewhere */}
                          {usedElsewhere && (
                            <span className="text-[10px] text-gray-400 shrink-0">In other field</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t bg-gray-50 rounded-b-xl shrink-0">
          <span className="text-sm text-gray-500">
            {selected.size} contact{selected.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleConfirm}>
              Add to {targetField.toUpperCase()}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
