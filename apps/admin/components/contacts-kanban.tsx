'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { ClockIcon, XMarkIcon, FunnelIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { submissionsApi } from '@/lib/api';

type ContactStatus = 'new' | 'reviewed' | 'contacted' | 'qualified' | 'proposal_sent' | 'won' | 'lost' | 'archived';

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
  status_changed_at?: string;
}

const PIPELINE_STAGES: { value: ContactStatus; label: string; color: string; headerBg: string }[] = [
  { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-800', headerBg: 'bg-blue-500' },
  { value: 'reviewed', label: 'Reviewed', color: 'bg-indigo-100 text-indigo-800', headerBg: 'bg-indigo-500' },
  { value: 'contacted', label: 'Contacted', color: 'bg-cyan-100 text-cyan-800', headerBg: 'bg-cyan-500' },
  { value: 'qualified', label: 'Qualified', color: 'bg-emerald-100 text-emerald-800', headerBg: 'bg-emerald-500' },
  { value: 'proposal_sent', label: 'Proposal Sent', color: 'bg-amber-100 text-amber-800', headerBg: 'bg-amber-500' },
  { value: 'won', label: 'Won', color: 'bg-green-100 text-green-800', headerBg: 'bg-green-500' },
  { value: 'lost', label: 'Lost', color: 'bg-red-100 text-red-800', headerBg: 'bg-red-500' },
  { value: 'archived', label: 'Archived', color: 'bg-gray-100 text-gray-600', headerBg: 'bg-gray-500' },
];

interface ContactsKanbanProps {
  contacts: Contact[];
  selectedContactId?: string;
  onSelectContact: (contact: Contact) => void;
  onContactUpdated: (contact: Contact) => void;
  formatDate: (date: string, options?: Intl.DateTimeFormatOptions) => string;
  searchTerm?: string;
}

function highlightMatch(text: string, search?: string): React.ReactNode {
  if (!search || !text) return text;
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === search.toLowerCase()
          ? <mark key={i} className="bg-yellow-200 rounded-sm px-0.5">{part}</mark>
          : part
      )}
    </>
  );
}

interface DragState {
  contactId: string;
  sourceStatus: ContactStatus;
}

interface ConfirmDialogState {
  contact: Contact;
  targetStatus: ContactStatus;
  targetLabel: string;
}

type ColumnFilter = 'all' | 'populated' | 'custom';

export default function ContactsKanban({
  contacts,
  selectedContactId,
  onSelectContact,
  onContactUpdated,
  formatDate,
  searchTerm,
}: ContactsKanbanProps) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<ContactStatus | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [comment, setComment] = useState('');
  const [updating, setUpdating] = useState(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  // Column filtering
  const [columnFilter, setColumnFilter] = useState<ColumnFilter>('populated');
  const [selectedColumns, setSelectedColumns] = useState<Set<ContactStatus>>(
    new Set(PIPELINE_STAGES.map(s => s.value))
  );
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  const populatedStatuses = useMemo(() => {
    const populated = new Set<ContactStatus>();
    for (const c of contacts) {
      populated.add((c.status || 'new') as ContactStatus);
    }
    return populated;
  }, [contacts]);

  const visibleStages = useMemo(() => {
    return PIPELINE_STAGES.filter(stage => {
      if (columnFilter === 'populated') return populatedStatuses.has(stage.value);
      if (columnFilter === 'custom') return selectedColumns.has(stage.value);
      return true;
    });
  }, [columnFilter, populatedStatuses, selectedColumns]);

  const toggleColumn = (status: ContactStatus) => {
    setSelectedColumns(prev => {
      const next = new Set(prev);
      if (next.has(status)) {
        if (next.size > 1) next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  const handleDragStart = useCallback((e: React.DragEvent, contact: Contact) => {
    const status = (contact.status || 'new') as ContactStatus;
    setDragState({ contactId: contact.id, sourceStatus: status });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', contact.id);
    // Capture element before rAF — React recycles the event so currentTarget becomes null
    const el = e.currentTarget as HTMLElement;
    requestAnimationFrame(() => {
      el.style.opacity = '0.5';
    });
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = '1';
    setDragState(null);
    setDropTarget(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, stageValue: ContactStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragState && dragState.sourceStatus !== stageValue) {
      setDropTarget(stageValue);
    }
  }, [dragState]);

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, stageValue: ContactStatus) => {
    e.preventDefault();
    setDropTarget(null);

    if (!dragState || dragState.sourceStatus === stageValue) return;

    const contact = contacts.find(c => c.id === dragState.contactId);
    if (!contact) return;

    const stage = PIPELINE_STAGES.find(s => s.value === stageValue);
    if (!stage) return;

    // Show confirmation dialog
    setConfirmDialog({
      contact,
      targetStatus: stageValue,
      targetLabel: stage.label,
    });
    setComment('');
    setDragState(null);

    // Focus the comment field after dialog renders
    setTimeout(() => commentRef.current?.focus(), 100);
  }, [dragState, contacts]);

  const handleConfirmMove = async () => {
    if (!confirmDialog) return;
    setUpdating(true);
    try {
      const result = await submissionsApi.updateStatus(
        confirmDialog.contact.id,
        confirmDialog.targetStatus,
        comment.trim() || undefined,
      );
      onContactUpdated(result.data);
      setConfirmDialog(null);
      setComment('');
    } catch {
      // Error handled by API interceptors
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelMove = () => {
    setConfirmDialog(null);
    setComment('');
  };

  const handleConfirmKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleConfirmMove();
    }
    if (e.key === 'Escape') {
      handleCancelMove();
    }
  };

  const getColumnDate = (contact: Contact): string => {
    const dateStr = contact.status_changed_at || contact.submitted_at;
    return formatDate(dateStr, { hour: undefined, minute: undefined });
  };

  return (
    <>
      {/* Column Filter Toolbar */}
      <div className="flex items-center gap-2 mb-3">
        <FunnelIcon className="h-4 w-4 text-gray-400" />
        <span className="text-xs text-gray-500 font-medium">Columns:</span>
        <div className="flex rounded-md border border-gray-200 overflow-hidden">
          {([
            { value: 'populated' as ColumnFilter, label: 'Populated' },
            { value: 'all' as ColumnFilter, label: 'All' },
            { value: 'custom' as ColumnFilter, label: 'Custom' },
          ]).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setColumnFilter(value);
                if (value === 'custom') setShowColumnPicker(true);
              }}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                columnFilter === value
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {columnFilter === 'custom' && (
          <button
            type="button"
            onClick={() => setShowColumnPicker(!showColumnPicker)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            {showColumnPicker ? 'Hide picker' : 'Edit columns'}
          </button>
        )}
        {columnFilter !== 'all' && (
          <span className="text-xs text-gray-400">
            {visibleStages.length} of {PIPELINE_STAGES.length} columns
          </span>
        )}
      </div>

      {/* Custom Column Picker */}
      {columnFilter === 'custom' && showColumnPicker && (
        <div className="flex flex-wrap gap-2 mb-3">
          {PIPELINE_STAGES.map(stage => {
            const isSelected = selectedColumns.has(stage.value);
            const count = contacts.filter(c => (c.status || 'new') === stage.value).length;
            return (
              <button
                key={stage.value}
                type="button"
                onClick={() => toggleColumn(stage.value)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                  isSelected
                    ? `${stage.color} border-transparent`
                    : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300'
                }`}
              >
                {isSelected ? (
                  <EyeIcon className="h-3 w-3" />
                ) : (
                  <EyeSlashIcon className="h-3 w-3" />
                )}
                {stage.label}
                {count > 0 && <span className="opacity-60">({count})</span>}
              </button>
            );
          })}
        </div>
      )}

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-max">
          {visibleStages.map(stage => {
            const stageContacts = contacts.filter(c => (c.status || 'new') === stage.value);
            const isDropZone = dropTarget === stage.value;
            const isDragSource = dragState?.sourceStatus === stage.value;

            return (
              <div key={stage.value} className="w-[240px] flex-shrink-0 flex flex-col">
                {/* Column header */}
                <div className={`${stage.headerBg} text-white px-3 py-2 rounded-t-lg flex items-center justify-between`}>
                  <span className="text-sm font-medium">{stage.label}</span>
                  <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">{stageContacts.length}</span>
                </div>
                {/* Column body — drop zone */}
                <div
                  onDragOver={(e) => handleDragOver(e, stage.value)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, stage.value)}
                  className={`rounded-b-lg p-2 space-y-2 min-h-[200px] flex-1 border border-t-0 transition-colors duration-150 ${
                    isDropZone
                      ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200'
                      : isDragSource
                        ? 'bg-gray-100 border-gray-300'
                        : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  {stageContacts.length === 0 ? (
                    <p className={`text-xs text-center py-4 ${isDropZone ? 'text-blue-400 font-medium' : 'text-gray-400'}`}>
                      {isDropZone ? 'Drop here' : 'No contacts'}
                    </p>
                  ) : (
                    stageContacts.map(contact => {
                      const isViewing = selectedContactId === contact.id;
                      const isDragging = dragState?.contactId === contact.id;
                      return (
                        <div
                          key={contact.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, contact)}
                          onDragEnd={handleDragEnd}
                          onClick={() => onSelectContact(contact)}
                          className={`bg-white rounded-lg p-3 border cursor-grab active:cursor-grabbing transition-all hover:shadow-sm select-none ${
                            isDragging
                              ? 'opacity-50 ring-2 ring-blue-300'
                              : isViewing
                                ? 'border-amber-400 ring-1 ring-amber-200 relative z-50'
                                : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <p className="font-medium text-sm truncate">{highlightMatch(contact.name, searchTerm)}</p>
                          {contact.company && (
                            <p className="text-xs text-gray-500 truncate mt-0.5">{highlightMatch(contact.company, searchTerm)}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">{getColumnDate(contact)}</p>
                          {contact.follow_up_at && (() => {
                            const diff = Math.ceil((new Date(contact.follow_up_at).getTime() - Date.now()) / 86400000);
                            return (
                              <div className={`flex items-center gap-1 mt-1.5 text-xs ${
                                diff < 0 ? 'text-red-500' : diff === 0 ? 'text-amber-600' : 'text-gray-400'
                              }`}>
                                <ClockIcon className="h-3 w-3" />
                                <span>
                                  {diff < 0 ? `Overdue ${Math.abs(diff)}d` : diff === 0 ? 'Due today' : `In ${diff}d`}
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div
            className="bg-white rounded-lg max-w-md w-full shadow-xl"
            onKeyDown={handleConfirmKeyDown}
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Move Contact</h3>
                <button
                  type="button"
                  onClick={handleCancelMove}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Move <span className="font-medium text-gray-900">{confirmDialog.contact.name}</span> to{' '}
                <span className="font-medium text-gray-900">{confirmDialog.targetLabel}</span>?
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comment <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  ref={commentRef}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a note about this status change..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">Press Enter to confirm, Shift+Enter for new line</p>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={handleCancelMove} disabled={updating}>
                  Cancel
                </Button>
                <Button onClick={() => void handleConfirmMove()} disabled={updating}>
                  {updating ? 'Moving...' : 'Confirm'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
