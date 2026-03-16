'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTimezone } from '@/lib/timezone';
import { useDisplayPrefs } from '@/lib/display-prefs';
import { isPrivateIp, truncateEmail } from '@/lib/utils';
import { submissionsApi, credentialsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  XMarkIcon,
  PencilSquareIcon,
  CheckCircleIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  PaperAirplaneIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

type ContactStatus = 'new' | 'reviewed' | 'contacted' | 'qualified' | 'proposal_sent' | 'won' | 'lost' | 'archived';

const PIPELINE_STAGES: { value: ContactStatus; label: string; color: string }[] = [
  { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-800' },
  { value: 'reviewed', label: 'Reviewed', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'contacted', label: 'Contacted', color: 'bg-cyan-100 text-cyan-800' },
  { value: 'qualified', label: 'Qualified', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'proposal_sent', label: 'Proposal Sent', color: 'bg-amber-100 text-amber-800' },
  { value: 'won', label: 'Won', color: 'bg-green-100 text-green-800' },
  { value: 'lost', label: 'Lost', color: 'bg-red-100 text-red-800' },
  { value: 'archived', label: 'Archived', color: 'bg-gray-100 text-gray-600' },
];

export function getStatusBadge(status?: string) {
  const stage = PIPELINE_STAGES.find(s => s.value === status) || PIPELINE_STAGES[0];
  return stage;
}

const NOTE_COLORS: { value: string; label: string; bg: string; border: string; dot: string }[] = [
  { value: 'gray',  label: 'Default',  bg: 'bg-white border-gray-150', border: 'border-gray-200', dot: 'bg-gray-400' },
  { value: 'blue',  label: 'Info',      bg: 'bg-blue-50',               border: 'border-blue-200', dot: 'bg-blue-400' },
  { value: 'green', label: 'Sent',      bg: 'bg-emerald-50',            border: 'border-emerald-200', dot: 'bg-emerald-400' },
  { value: 'amber', label: 'Follow-up', bg: 'bg-amber-50',              border: 'border-amber-200', dot: 'bg-amber-400' },
  { value: 'red',   label: 'Important', bg: 'bg-red-50',                border: 'border-red-200', dot: 'bg-red-400' },
];

function getNoteStyle(color?: string) {
  return NOTE_COLORS.find(c => c.value === color) || NOTE_COLORS[0];
}

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
  status?: ContactStatus;
  follow_up_at?: string;
}

type NoteSubtype = 'note' | 'todo' | 'message' | 'reply';

interface ContactNote {
  id: number;
  contact_id: number;
  content: string;
  type: 'manual' | 'system';
  subtype?: NoteSubtype;
  color?: string;
  is_done?: boolean | number;
  completed_at?: string;
  due_at?: string;
  created_at: string;
}

interface ContactDetailPanelProps {
  contact: Contact;
  onClose: () => void;
  onContactUpdated: (contact: Contact) => void;
}

export default function ContactDetailPanel({ contact, onClose, onContactUpdated }: ContactDetailPanelProps) {
  const { formatDate } = useTimezone();
  const { prefs } = useDisplayPrefs();
  const panelRef = useRef<HTMLDivElement>(null);

  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '', company: '', project_type: '', message: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Notes
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [noteColor, setNoteColor] = useState('gray');
  const [noteSubtype, setNoteSubtype] = useState<NoteSubtype>('note');
  const [addingNote, setAddingNote] = useState(false);

  // Todo due date for new todos
  const [todoDueDate, setTodoDueDate] = useState<string>('');

  // Status & follow-up
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [followUpUpdating, setFollowUpUpdating] = useState(false);
  const [statusChangeDialog, setStatusChangeDialog] = useState<{ targetStatus: ContactStatus; targetLabel: string } | null>(null);
  const [statusComment, setStatusComment] = useState('');
  const statusCommentRef = useRef<HTMLTextAreaElement>(null);

  // Email compose
  const [showCompose, setShowCompose] = useState(false);
  const [composeStep, setComposeStep] = useState<'write' | 'preview' | 'confirm'>('write');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState<{ success: boolean; message: string } | null>(null);
  const [fromAddress, setFromAddress] = useState<string>('');

  const loadNotes = useCallback(async () => {
    try {
      const res = await submissionsApi.getNotes(contact.id);
      setNotes(res.data || []);
    } catch {
      // silently fail
    } finally {
      setNotesLoading(false);
    }
  }, [contact.id]);

  useEffect(() => {
    setNotesLoading(true);
    void loadNotes();
  }, [loadNotes]);

  // Track whether a modal dialog is open (status change, email compose)
  const hasModalOpen = !!statusChangeDialog || showCompose;

  // Close on Escape — but not when a modal dialog is open
  useEffect(() => {
    if (hasModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, hasModalOpen]);

  // Close on click outside — but not when a modal dialog is open
  useEffect(() => {
    if (hasModalOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose, hasModalOpen]);

  const copyEmail = async (email: string) => {
    await navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const openEditMode = () => {
    setEditForm({
      name: contact.name,
      email: contact.email,
      company: contact.company ?? '',
      project_type: contact.project_type ?? '',
      message: contact.message,
    });
    setEditError(null);
    setEditMode(true);
  };

  const handleSaveEdit = async () => {
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await submissionsApi.update(contact.id, editForm);
      const updated = res.data as Contact;
      onContactUpdated(updated);
      setEditMode(false);
    } catch {
      setEditError('Failed to save changes.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleStatusChange = (newStatus: ContactStatus) => {
    if (newStatus === (contact.status || 'new')) return;
    const stage = PIPELINE_STAGES.find(s => s.value === newStatus);
    setStatusChangeDialog({ targetStatus: newStatus, targetLabel: stage?.label || newStatus });
    setStatusComment('');
    setTimeout(() => statusCommentRef.current?.focus(), 100);
  };

  const handleConfirmStatusChange = async () => {
    if (!statusChangeDialog) return;
    setStatusUpdating(true);
    try {
      const res = await submissionsApi.updateStatus(
        contact.id,
        statusChangeDialog.targetStatus,
        statusComment.trim() || undefined,
      );
      const updated = res.data as Contact;
      onContactUpdated(updated);
      setStatusChangeDialog(null);
      setStatusComment('');
      void loadNotes();
    } catch {
      // silently fail
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleCancelStatusChange = () => {
    setStatusChangeDialog(null);
    setStatusComment('');
  };

  const handleFollowUpChange = async (dateStr: string) => {
    setFollowUpUpdating(true);
    try {
      const value = dateStr || null;
      const res = await submissionsApi.updateFollowUp(contact.id, value);
      const updated = res.data as Contact;
      onContactUpdated(updated);
      void loadNotes();
    } catch {
      // silently fail
    } finally {
      setFollowUpUpdating(false);
    }
  };

  const openCompose = () => {
    setShowCompose(true);
    setComposeStep('write');
    setEmailSubject('');
    setEmailBody('');
    setEmailResult(null);
    // Fetch the configured from address
    if (!fromAddress) {
      void credentialsApi.get().then((res) => {
        const email = res.data?.email;
        if (email?.from_address) {
          const display = email.display_name ? `${email.display_name} <${email.from_address}>` : email.from_address;
          setFromAddress(display);
        }
      }).catch(() => { /* ignore — from field will just be empty */ });
    }
  };

  const handleSendEmail = async () => {
    setSendingEmail(true);
    setEmailResult(null);
    try {
      await submissionsApi.sendEmail(contact.id, emailSubject, emailBody);
      setEmailResult({ success: true, message: `Email sent to ${contact.email}` });
      setComposeStep('write');
      setEmailSubject('');
      setEmailBody('');
      void loadNotes(); // Refresh to show the new message note
      // Auto-close after success
      setTimeout(() => {
        setShowCompose(false);
        setEmailResult(null);
      }, 2000);
    } catch (err) {
      const e = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setEmailResult({
        success: false,
        message: e.response?.data?.error?.message ?? e.message ?? 'Failed to send email',
      });
      setComposeStep('write'); // Go back to edit on error
    } finally {
      setSendingEmail(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      await submissionsApi.addNote(
        contact.id,
        newNote.trim(),
        noteColor !== 'gray' ? noteColor : undefined,
        noteSubtype,
        noteSubtype === 'todo' && todoDueDate ? todoDueDate : undefined,
      );
      setNewNote('');
      setNoteColor('gray');
      setNoteSubtype('note');
      setTodoDueDate('');
      void loadNotes();
    } catch {
      // silently fail
    } finally {
      setAddingNote(false);
    }
  };

  const handleToggleDone = async (noteId: number) => {
    try {
      const res = await submissionsApi.toggleNoteDone(contact.id, noteId);
      const updated = res.data as ContactNote;
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, is_done: updated.is_done, completed_at: updated.completed_at } : n));
    } catch {
      // silently fail
    }
  };

  const handleUpdateTodoDue = async (noteId: number, dateStr: string | null) => {
    try {
      const res = await submissionsApi.updateTodoDue(contact.id, noteId, dateStr);
      const updated = res.data as ContactNote;
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, due_at: updated.due_at } : n));
    } catch {
      // silently fail
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    try {
      await submissionsApi.deleteNote(contact.id, noteId);
      setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch {
      // silently fail
    }
  };

  const countryFlag = (iso: string) => {
    if (!iso || iso.length !== 2) return '';
    return String.fromCodePoint(...[...iso.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0)));
  };

  const getProjectTypeColor = (type?: string) => {
    const colors: Record<string, string> = {
      web: 'bg-blue-100 text-blue-800',
      mobile: 'bg-green-100 text-green-800',
      desktop: 'bg-purple-100 text-purple-800',
      consulting: 'bg-yellow-100 text-yellow-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return colors[type || 'other'] || colors.other;
  };

  const openDatePicker = (current: string, onChange: (val: string) => void, e?: React.MouseEvent) => {
    const input = document.createElement('input');
    input.type = 'date';
    input.value = current;
    input.onchange = () => { if (input.value) onChange(input.value); };
    input.style.position = 'fixed';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    if (e) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      input.style.top = `${rect.bottom}px`;
      input.style.left = `${rect.left}px`;
    }
    document.body.appendChild(input);
    input.showPicker();
    const cleanup = () => { if (input.parentNode) input.remove(); };
    input.addEventListener('change', cleanup, { once: true });
    input.addEventListener('blur', cleanup, { once: true });
    setTimeout(cleanup, 60000); // fallback: remove after 60s no matter what
  };

  const currentStatus = contact.status || 'new';
  const panelWidth = expanded ? 'w-[720px]' : 'w-[420px]';

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" />

      {/* Slide-in panel */}
      <div
        ref={panelRef}
        className={`fixed top-0 right-0 h-full ${panelWidth} max-w-full bg-white shadow-xl z-50 flex flex-col animate-in slide-in-from-right duration-200 transition-[width] ease-in-out`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold truncate">{contact.name}</h2>
            <div className="group flex items-center gap-1.5 mt-0.5">
              <span className="text-sm text-gray-500 truncate">
                {prefs.truncateEmails ? truncateEmail(contact.email) : contact.email}
              </span>
              <button
                type="button"
                onClick={() => void copyEmail(contact.email)}
                title="Copy email"
                className={`transition-colors shrink-0 ${copiedEmail === contact.email ? 'text-emerald-500' : 'text-gray-400 opacity-0 group-hover:opacity-100 hover:text-gray-600'}`}
              >
                {copiedEmail === contact.email ? <CheckIcon className="h-3.5 w-3.5" /> : <ClipboardDocumentIcon className="h-3.5 w-3.5" />}
              </button>
            </div>
            {contact.company && <p className="text-sm text-gray-500 mt-0.5">{contact.company}</p>}
          </div>
          <div className="flex items-center gap-1 ml-2">
            {!editMode && (
              <>
                <Button variant="ghost" size="sm" onClick={openCompose} title="Send email to contact">
                  <PaperAirplaneIcon className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={openEditMode} title="Edit contact">
                  <PencilSquareIcon className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={() => setExpanded(e => !e)} title={expanded ? 'Collapse panel' : 'Expand panel'}>
              {expanded ? <ArrowsPointingInIcon className="h-4 w-4" /> : <ArrowsPointingOutIcon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <XMarkIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {editMode ? (
            /* ── Edit mode ── */
            <div className="space-y-4">
              <div className={`grid gap-3 ${expanded ? 'grid-cols-2' : 'grid-cols-2'}`}>
                <div>
                  <label className="text-xs font-medium text-gray-500">Name</label>
                  <Input className="mt-1" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Email</label>
                  <Input className="mt-1" type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Company</label>
                  <Input className="mt-1" value={editForm.company} onChange={e => setEditForm(f => ({ ...f, company: e.target.value }))} placeholder="Optional" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Project Type</label>
                  <Input className="mt-1" value={editForm.project_type} onChange={e => setEditForm(f => ({ ...f, project_type: e.target.value }))} placeholder="web / mobile…" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Message</label>
                <textarea
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  rows={expanded ? 6 : 4}
                  value={editForm.message}
                  onChange={e => setEditForm(f => ({ ...f, message: e.target.value }))}
                />
              </div>
              {editError && (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{editError}</div>
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void handleSaveEdit()} disabled={editSaving}>
                  <CheckCircleIcon className="h-4 w-4 mr-1" />
                  {editSaving ? 'Saving…' : 'Save'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              {/* Meta info */}
              <div className="text-sm text-gray-500">
                <span>Submitted: {formatDate(contact.submitted_at)}</span>
                {contact.project_type && (
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${getProjectTypeColor(contact.project_type)}`}>
                    {contact.project_type}
                  </span>
                )}
              </div>

              {prefs.showGeoInfo && (contact.ip_address || contact.country) && (
                <div className="text-sm text-gray-500">
                  {(() => {
                    const ip = contact.ip_address;
                    const priv = ip ? isPrivateIp(ip) : false;
                    return (
                      <div className="flex items-center gap-1.5">
                        {contact.country && !priv && (
                          <span title={contact.country_name ?? contact.country}>{countryFlag(contact.country)}</span>
                        )}
                        {ip && <span className="font-mono text-xs">{ip}</span>}
                        {priv && <span className="text-xs italic">private</span>}
                        {!priv && contact.city && (
                          <span className="text-xs">
                            {[contact.city, contact.region, contact.country_name].filter(Boolean).join(', ')}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Status + Follow-up row */}
              <div className="flex items-start gap-3">
                {/* Status */}
                <div className="flex-1 min-w-0">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Status</label>
                  <select
                    value={currentStatus}
                    onChange={e => void handleStatusChange(e.target.value as ContactStatus)}
                    disabled={statusUpdating}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {PIPELINE_STAGES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                {/* Follow-up — compact inline chip */}
                <div className="shrink-0">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Reminder</label>
                  {contact.follow_up_at ? (() => {
                    const diff = Math.ceil((new Date(contact.follow_up_at).getTime() - Date.now()) / 86400000);
                    const dateLabel = new Date(contact.follow_up_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const isOverdue = diff < 0;
                    const isToday = diff === 0;
                    const relLabel = isOverdue
                      ? `${Math.abs(diff)}d overdue`
                      : isToday ? 'today'
                      : `in ${diff}d`;
                    return (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => openDatePicker(contact.follow_up_at!.split('T')[0], v => void handleFollowUpChange(v), e)}
                          disabled={followUpUpdating}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors ${
                            isOverdue ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                            : isToday ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                            : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-150'
                          } disabled:opacity-50`}
                        >
                          <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{dateLabel}</span>
                          <span className="opacity-60">{relLabel}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleFollowUpChange('')}
                          disabled={followUpUpdating}
                          className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
                          title="Clear reminder"
                        >
                          <XMarkIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })() : (
                    <button
                      type="button"
                      onClick={(e) => openDatePicker('', v => void handleFollowUpChange(v), e)}
                      disabled={followUpUpdating}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium cursor-pointer
                        text-gray-400 border border-dashed border-gray-300 hover:border-gray-400 hover:text-gray-600 transition-colors
                        ${followUpUpdating ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>+ Reminder</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Initial message — styled as received message */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Initial Message</label>
                <div className="p-3 bg-blue-50 rounded-lg text-sm border border-blue-200 border-l-4 border-l-blue-400">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-blue-500 shrink-0" title="Message from contact">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="whitespace-pre-wrap">{contact.message}</p>
                      <p className="text-xs text-blue-400 mt-1.5">{formatDate(contact.submitted_at)} — from {contact.name}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Activity thread */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-2">Activity</label>
                {notesLoading ? (
                  <p className="text-sm text-gray-400">Loading…</p>
                ) : notes.length === 0 ? (
                  <p className="text-sm text-gray-400">No activity yet</p>
                ) : (
                  <div className="space-y-2">
                    {notes.map(note => {
                      if (note.type === 'system') {
                        return (
                          <div key={note.id} className="text-sm rounded px-3 py-2 bg-gray-50 text-gray-500 italic">
                            <p>{note.content}</p>
                            <p className="text-xs text-gray-400 mt-1">{formatDate(note.created_at)}</p>
                          </div>
                        );
                      }

                      const style = getNoteStyle(note.color);
                      const subtype = (note.subtype || 'note') as NoteSubtype;
                      const isDone = note.is_done === true || note.is_done === 1;

                      return (
                        <div
                          key={note.id}
                          className={`group/note text-sm rounded-lg px-3 py-2 border ${
                            subtype === 'reply'
                              ? 'bg-blue-50 border-blue-200 border-l-4 border-l-blue-400'
                              : `${style.bg} ${style.border} ${
                                  subtype === 'message' ? 'border-l-4 border-l-indigo-400' :
                                  subtype === 'todo' && isDone ? 'opacity-60' : ''
                                }`
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 flex-1 min-w-0">
                              {subtype === 'todo' ? (
                                <button
                                  type="button"
                                  onClick={() => void handleToggleDone(note.id)}
                                  className={`mt-0.5 h-4 w-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                                    isDone
                                      ? 'bg-emerald-500 border-emerald-500 text-white'
                                      : 'border-gray-300 hover:border-emerald-400'
                                  }`}
                                  title={isDone ? 'Mark undone' : 'Mark done'}
                                >
                                  {isDone && (
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </button>
                              ) : subtype === 'reply' ? (
                                <span className="mt-0.5 text-blue-500 shrink-0" title="Reply from contact">
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                  </svg>
                                </span>
                              ) : subtype === 'message' ? (
                                <span className="mt-0.5 text-indigo-500 shrink-0" title="Message sent">
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                                  </svg>
                                </span>
                              ) : (
                                <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${style.dot}`} />
                              )}
                              <p className={`whitespace-pre-wrap flex-1 ${isDone ? 'line-through text-gray-400' : ''}`}>
                                {note.content}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleDeleteNote(note.id)}
                              className="opacity-0 group-hover/note:opacity-100 text-gray-400 hover:text-red-500 transition-opacity shrink-0 mt-0.5"
                              title="Delete note"
                            >
                              <XMarkIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="text-xs text-gray-400 mt-1 ml-6 flex items-center flex-wrap gap-x-1.5">
                            <span>{formatDate(note.created_at)}</span>
                            {subtype !== 'note' && (
                              <span className={
                                subtype === 'todo' ? 'text-emerald-500'
                                : subtype === 'reply' ? 'text-blue-500'
                                : 'text-indigo-500'
                              }>
                                {subtype === 'todo' ? (isDone ? `Done${note.completed_at ? ` ${formatDate(note.completed_at)}` : ''}` : 'Todo')
                                : subtype === 'reply' ? 'Reply from contact'
                                : 'Message sent'}
                              </span>
                            )}
                            {subtype === 'todo' && (() => {
                              const dueAt = note.due_at;
                              if (!dueAt && isDone) return null;
                              if (dueAt) {
                                const diff = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86400000);
                                const isOverdue = diff < 0 && !isDone;
                                const isToday = diff === 0;
                                const dateLabel = new Date(dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                return (
                                  <span className="inline-flex items-center gap-0.5">
                                    <button
                                      type="button"
                                      onClick={(e) => openDatePicker(dueAt.split('T')[0], v => void handleUpdateTodoDue(note.id, v), e)}
                                      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0 text-xs font-medium cursor-pointer transition-colors ${
                                        isDone ? 'bg-gray-100 text-gray-400 line-through'
                                        : isOverdue ? 'bg-red-100 text-red-700'
                                        : isToday ? 'bg-amber-100 text-amber-700'
                                        : 'bg-gray-100 text-gray-600'
                                      }`}
                                      title="Change due date"
                                    >
                                      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      {isOverdue ? 'Overdue' : isToday ? 'Due today' : `Due ${dateLabel}`}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleUpdateTodoDue(note.id, null)}
                                      className="opacity-0 group-hover/note:opacity-100 text-gray-300 hover:text-red-500 transition-opacity"
                                      title="Clear due date"
                                    >
                                      <XMarkIcon className="h-3 w-3" />
                                    </button>
                                  </span>
                                );
                              }
                              // No due date, show clock icon on hover to add one
                              return (
                                <button
                                  type="button"
                                  onClick={(e) => openDatePicker('', v => void handleUpdateTodoDue(note.id, v), e)}
                                  className="opacity-0 group-hover/note:opacity-100 text-gray-300 hover:text-gray-500 transition-opacity"
                                  title="Set due date"
                                >
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </button>
                              );
                            })()}
                            {note.color && note.color !== 'gray' && (
                              <span>{NOTE_COLORS.find(c => c.value === note.color)?.label}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add note */}
                <div className="mt-3 space-y-2">
                  {/* Type selector */}
                  <div className="flex rounded-md border border-input overflow-hidden w-fit">
                    {([
                      { value: 'note' as NoteSubtype, label: 'Note' },
                      { value: 'todo' as NoteSubtype, label: 'Todo' },
                      { value: 'message' as NoteSubtype, label: 'Sent' },
                      { value: 'reply' as NoteSubtype, label: 'Reply' },
                    ]).map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setNoteSubtype(value);
                          if (value === 'todo' && !todoDueDate) {
                            const tomorrow = new Date();
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            setTodoDueDate(tomorrow.toISOString().split('T')[0]);
                          }
                        }}
                        className={`px-3 py-1 text-xs font-medium transition-colors ${
                          noteSubtype === value
                            ? value === 'todo' ? 'bg-emerald-600 text-white'
                            : value === 'message' ? 'bg-indigo-600 text-white'
                            : value === 'reply' ? 'bg-blue-600 text-white'
                            : 'bg-gray-900 text-white'
                            : 'bg-background text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    placeholder={
                      noteSubtype === 'todo' ? 'Add a task…'
                      : noteSubtype === 'message' ? 'Log a message sent…'
                      : noteSubtype === 'reply' ? 'Log a reply from the contact…'
                      : 'Add a note…'
                    }
                    rows={expanded ? 3 : 2}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        void handleAddNote();
                      }
                    }}
                  />
                  <div className="flex items-center justify-between">
                    {/* Color picker */}
                    <div className="flex items-center gap-1.5">
                      {NOTE_COLORS.map(c => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setNoteColor(c.value)}
                          title={c.label}
                          className={`h-5 w-5 rounded-full border-2 transition-all ${c.dot} ${
                            noteColor === c.value
                              ? 'border-gray-800 scale-110'
                              : 'border-transparent hover:border-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {noteSubtype === 'todo' && (
                        <>
                          {todoDueDate ? (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                              <button
                                type="button"
                                onClick={(e) => openDatePicker(todoDueDate, v => setTodoDueDate(v), e)}
                                className="inline-flex items-center gap-0.5 hover:text-gray-900 transition-colors"
                              >
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Due {new Date(todoDueDate + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </button>
                              <button
                                type="button"
                                onClick={() => setTodoDueDate('')}
                                className="text-gray-400 hover:text-red-500 transition-colors"
                                title="Clear due date"
                              >
                                <XMarkIcon className="h-3 w-3" />
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => openDatePicker('', v => setTodoDueDate(v), e)}
                              className="text-gray-400 hover:text-gray-600 transition-colors"
                              title="Set due date"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                              </svg>
                            </button>
                          )}
                        </>
                      )}
                      <Button
                        size="sm"
                        onClick={() => void handleAddNote()}
                        disabled={addingNote || !newNote.trim()}
                      >
                        {addingNote ? 'Adding…' : noteSubtype === 'todo' ? 'Add Todo' : noteSubtype === 'message' ? 'Log Sent' : noteSubtype === 'reply' ? 'Log Reply' : 'Add Note'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              {/* Bottom padding so content isn't flush against panel edge */}
              <div className="pb-6" />
            </>
          )}
        </div>
      </div>

      {/* Status Change Dialog */}
      {statusChangeDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div
            className="bg-white rounded-lg max-w-md w-full shadow-xl"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleConfirmStatusChange();
              }
              if (e.key === 'Escape') handleCancelStatusChange();
            }}
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Change Status</h3>
                <button
                  type="button"
                  onClick={handleCancelStatusChange}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Move <span className="font-medium text-gray-900">{contact.name}</span> to{' '}
                <span className="font-medium text-gray-900">{statusChangeDialog.targetLabel}</span>?
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comment <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  ref={statusCommentRef}
                  value={statusComment}
                  onChange={(e) => setStatusComment(e.target.value)}
                  placeholder="Add a note about this status change..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">Press Enter to confirm, Shift+Enter for new line</p>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={handleCancelStatusChange} disabled={statusUpdating}>
                  Cancel
                </Button>
                <Button onClick={() => void handleConfirmStatusChange()} disabled={statusUpdating}>
                  {statusUpdating ? 'Updating...' : 'Confirm'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white rounded-lg max-w-lg w-full shadow-xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="flex items-center gap-2">
                <PaperAirplaneIcon className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold">
                  {composeStep === 'confirm' ? 'Confirm Send' : composeStep === 'preview' ? 'Preview Email' : 'Compose Email'}
                </h3>
              </div>
              <button type="button" onClick={() => setShowCompose(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* From field */}
              {fromAddress && (
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">From</label>
                  <div className="px-3 py-2 bg-gray-50 rounded-md text-sm border border-gray-200 text-gray-600">
                    {fromAddress}
                  </div>
                </div>
              )}

              {/* To field (always shown, read-only) */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">To</label>
                <div className="px-3 py-2 bg-gray-50 rounded-md text-sm border border-gray-200">
                  {contact.name} &lt;{contact.email}&gt;
                </div>
              </div>

              {emailResult && (
                <div className={`p-3 rounded-md text-sm ${
                  emailResult.success
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {emailResult.message}
                </div>
              )}

              {/* Write step */}
              {composeStep === 'write' && (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Subject *</label>
                    <Input
                      value={emailSubject}
                      onChange={e => setEmailSubject(e.target.value)}
                      placeholder="Email subject..."
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Message *</label>
                    <textarea
                      value={emailBody}
                      onChange={e => setEmailBody(e.target.value)}
                      placeholder="Write your message..."
                      rows={8}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">Plain text — line breaks will be preserved.</p>
                  </div>
                </>
              )}

              {/* Preview step */}
              {composeStep === 'preview' && (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Subject</label>
                    <div className="px-3 py-2 bg-gray-50 rounded-md text-sm border border-gray-200 font-medium">
                      {emailSubject}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Message Preview</label>
                    <div className="px-3 py-3 bg-gray-50 rounded-md text-sm border border-gray-200 whitespace-pre-wrap min-h-[100px]">
                      {emailBody}
                    </div>
                  </div>
                </>
              )}

              {/* Confirm step — safety pin */}
              {composeStep === 'confirm' && (
                <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <ExclamationTriangleIcon className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800">You are about to send a real email</p>
                      <p className="text-sm text-amber-700 mt-1">
                        This will send an email to <span className="font-medium">{contact.email}</span> with
                        subject &quot;<span className="font-medium">{emailSubject}</span>&quot;.
                      </p>
                      <p className="text-sm text-amber-700 mt-1">This action cannot be undone.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between px-5 py-4 border-t bg-gray-50 rounded-b-lg">
              <div>
                {composeStep !== 'write' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setComposeStep(composeStep === 'confirm' ? 'preview' : 'write')}
                    disabled={sendingEmail}
                  >
                    Back
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowCompose(false)} disabled={sendingEmail}>
                  Cancel
                </Button>
                {composeStep === 'write' && (
                  <Button
                    onClick={() => setComposeStep('preview')}
                    disabled={!emailSubject.trim() || !emailBody.trim()}
                  >
                    Preview
                  </Button>
                )}
                {composeStep === 'preview' && (
                  <Button onClick={() => setComposeStep('confirm')}>
                    Continue to Send
                  </Button>
                )}
                {composeStep === 'confirm' && (
                  <Button
                    onClick={() => void handleSendEmail()}
                    disabled={sendingEmail}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <PaperAirplaneIcon className="h-4 w-4 mr-1" />
                    {sendingEmail ? 'Sending…' : 'Send Email'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
