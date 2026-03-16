'use client';

import { useState, useEffect, useRef } from 'react';
import { useTimezone } from '@/lib/timezone';
import { useDisplayPrefs } from '@/lib/display-prefs';
import { isPrivateIp, truncateEmail } from '@/lib/utils';
import { useCopyToClipboard } from '@/lib/hooks/use-copy-to-clipboard';
import { submissionsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  XMarkIcon,
  PencilSquareIcon,
  CheckCircleIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  PaperAirplaneIcon,
  ClipboardDocumentIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

import type { Contact, ContactStatus } from './contact-detail/contact-utils';
import { PIPELINE_STAGES, countryFlag, getProjectTypeColor, openDatePicker } from './contact-detail/contact-utils';
import ContactNotesSection from './contact-detail/contact-notes-section';
import ContactEmailComposer from './contact-detail/contact-email-composer';
import ContactStatusDialog from './contact-detail/contact-status-dialog';

// Re-export for consumers (contacts/page.tsx imports this)
export { getStatusBadge } from './contact-detail/contact-utils';
export type { Contact, ContactStatus } from './contact-detail/contact-utils';

interface ContactDetailPanelProps {
  contact: Contact;
  onClose: () => void;
  onContactUpdated: (contact: Contact) => void;
}

export default function ContactDetailPanel({ contact, onClose, onContactUpdated }: ContactDetailPanelProps) {
  const { formatDate } = useTimezone();
  const { prefs } = useDisplayPrefs();
  const panelRef = useRef<HTMLDivElement>(null);

  const { copy: copyEmail, isCopied: isEmailCopied } = useCopyToClipboard();
  const [expanded, setExpanded] = useState(false);

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '', company: '', project_type: '', message: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Status & follow-up
  const [followUpUpdating, setFollowUpUpdating] = useState(false);
  const [statusChangeDialog, setStatusChangeDialog] = useState<{ targetStatus: ContactStatus; targetLabel: string } | null>(null);

  // Email compose
  const [showCompose, setShowCompose] = useState(false);

  const hasModalOpen = !!statusChangeDialog || showCompose;

  // Close on Escape (unless modal open)
  useEffect(() => {
    if (hasModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, hasModalOpen]);

  // Close on click outside (unless modal open)
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
      onContactUpdated(res.data as Contact);
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
  };

  const handleFollowUpChange = async (dateStr: string) => {
    setFollowUpUpdating(true);
    try {
      const value = dateStr || null;
      const res = await submissionsApi.updateFollowUp(contact.id, value);
      onContactUpdated(res.data as Contact);
    } catch {
      // silently fail
    } finally {
      setFollowUpUpdating(false);
    }
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
                onClick={() => void copyEmail(contact.email, contact.email)}
                title="Copy email"
                className={`transition-colors shrink-0 ${isEmailCopied(contact.email) ? 'text-emerald-500' : 'text-gray-400 opacity-0 group-hover:opacity-100 hover:text-gray-600'}`}
              >
                {isEmailCopied(contact.email) ? <CheckIcon className="h-3.5 w-3.5" /> : <ClipboardDocumentIcon className="h-3.5 w-3.5" />}
              </button>
            </div>
            {contact.company && <p className="text-sm text-gray-500 mt-0.5">{contact.company}</p>}
          </div>
          <div className="flex items-center gap-1 ml-2">
            {!editMode && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setShowCompose(true)} title="Send email to contact">
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
            /* Edit mode */
            <div className="space-y-4">
              <div className="grid gap-3 grid-cols-2">
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
                <div className="flex-1 min-w-0">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Status</label>
                  <select
                    value={currentStatus}
                    onChange={e => void handleStatusChange(e.target.value as ContactStatus)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {PIPELINE_STAGES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                {/* Follow-up reminder */}
                <div className="shrink-0">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Reminder</label>
                  {contact.follow_up_at ? (() => {
                    const diff = Math.ceil((new Date(contact.follow_up_at).getTime() - Date.now()) / 86400000);
                    const dateLabel = new Date(contact.follow_up_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const isOverdue = diff < 0;
                    const isToday = diff === 0;
                    const relLabel = isOverdue ? `${Math.abs(diff)}d overdue` : isToday ? 'today' : `in ${diff}d`;
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

              {/* Initial message */}
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

              {/* Activity / Notes */}
              <ContactNotesSection contactId={contact.id} expanded={expanded} />

              <div className="pb-6" />
            </>
          )}
        </div>
      </div>

      {/* Status Change Dialog */}
      {statusChangeDialog && (
        <ContactStatusDialog
          contact={contact}
          targetStatus={statusChangeDialog.targetStatus}
          targetLabel={statusChangeDialog.targetLabel}
          onConfirm={(updated) => {
            onContactUpdated(updated);
            setStatusChangeDialog(null);
          }}
          onCancel={() => setStatusChangeDialog(null)}
        />
      )}

      {/* Email Compose Modal */}
      <ContactEmailComposer
        contactId={contact.id}
        contactName={contact.name}
        contactEmail={contact.email}
        open={showCompose}
        onClose={() => setShowCompose(false)}
        onSent={() => { /* notes section auto-refreshes */ }}
      />
    </>
  );
}
