'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTimezone } from '@/lib/timezone';
import { submissionsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { ContactNote, NoteSubtype } from './contact-utils';
import { NOTE_COLORS, getNoteStyle, openDatePicker } from './contact-utils';

interface ContactNotesSectionProps {
  contactId: string;
  expanded?: boolean;
}

export default function ContactNotesSection({ contactId, expanded }: ContactNotesSectionProps) {
  const { formatDate } = useTimezone();

  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [noteColor, setNoteColor] = useState('gray');
  const [noteSubtype, setNoteSubtype] = useState<NoteSubtype>('note');
  const [addingNote, setAddingNote] = useState(false);
  const [todoDueDate, setTodoDueDate] = useState<string>('');

  const loadNotes = useCallback(async () => {
    try {
      const res = await submissionsApi.getNotes(contactId);
      setNotes(res.data || []);
    } catch {
      // silently fail
    } finally {
      setNotesLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    setNotesLoading(true);
    void loadNotes();
  }, [loadNotes]);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      await submissionsApi.addNote(
        contactId,
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
      const res = await submissionsApi.toggleNoteDone(contactId, noteId);
      const updated = res.data as ContactNote;
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, is_done: updated.is_done, completed_at: updated.completed_at } : n));
    } catch { /* silently fail */ }
  };

  const handleUpdateTodoDue = async (noteId: number, dateStr: string | null) => {
    try {
      const res = await submissionsApi.updateTodoDue(contactId, noteId, dateStr);
      const updated = res.data as ContactNote;
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, due_at: updated.due_at } : n));
    } catch { /* silently fail */ }
  };

  const handleDeleteNote = async (noteId: number) => {
    try {
      await submissionsApi.deleteNote(contactId, noteId);
      setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch { /* silently fail */ }
  };

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-2">Activity</label>
      {notesLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet</p>
      ) : (
        <div className="space-y-2">
          {notes.map(note => {
            if (note.type === 'system') {
              return (
                <div key={note.id} className="text-sm rounded px-3 py-2 bg-muted text-muted-foreground italic">
                  <p>{note.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(note.created_at)}</p>
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
                          isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border hover:border-emerald-400'
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
                    <p className={`whitespace-pre-wrap flex-1 ${isDone ? 'line-through text-muted-foreground' : ''}`}>
                      {note.content}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDeleteNote(note.id)}
                    className="opacity-0 group-hover/note:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity shrink-0 mt-0.5"
                    title="Delete note"
                  >
                    <XMarkIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="text-xs text-muted-foreground mt-1 ml-6 flex items-center flex-wrap gap-x-1.5">
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
                              isDone ? 'bg-accent text-muted-foreground line-through'
                              : isOverdue ? 'bg-red-100 text-red-700'
                              : isToday ? 'bg-amber-100 text-amber-700'
                              : 'bg-accent text-muted-foreground'
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
                            className="opacity-0 group-hover/note:opacity-100 text-muted-foreground/50 hover:text-red-500 transition-opacity"
                            title="Clear due date"
                          >
                            <XMarkIcon className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    }
                    return (
                      <button
                        type="button"
                        onClick={(e) => openDatePicker('', v => void handleUpdateTodoDue(note.id, v), e)}
                        className="opacity-0 group-hover/note:opacity-100 text-muted-foreground/50 hover:text-muted-foreground transition-opacity"
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
                  : 'bg-foreground text-background'
                  : 'bg-background text-muted-foreground hover:text-foreground hover:bg-accent'
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
                  noteColor === c.value ? 'border-foreground scale-110' : 'border-transparent hover:border-border'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {noteSubtype === 'todo' && (
              <>
                {todoDueDate ? (
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-accent text-muted-foreground border border-border">
                    <button
                      type="button"
                      onClick={(e) => openDatePicker(todoDueDate, v => setTodoDueDate(v), e)}
                      className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Due {new Date(todoDueDate + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTodoDueDate('')}
                      className="text-muted-foreground hover:text-red-500 transition-colors"
                      title="Clear due date"
                    >
                      <XMarkIcon className="h-3 w-3" />
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => openDatePicker('', v => setTodoDueDate(v), e)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
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
  );
}
