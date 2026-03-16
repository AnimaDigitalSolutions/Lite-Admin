'use client';

import { useState, useRef } from 'react';
import { submissionsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { Contact, ContactStatus } from './contact-utils';

interface ContactStatusDialogProps {
  contact: Contact;
  targetStatus: ContactStatus;
  targetLabel: string;
  onConfirm: (updated: Contact) => void;
  onCancel: () => void;
}

export default function ContactStatusDialog({ contact, targetStatus, targetLabel, onConfirm, onCancel }: ContactStatusDialogProps) {
  const [statusComment, setStatusComment] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  const handleConfirm = async () => {
    setStatusUpdating(true);
    try {
      const res = await submissionsApi.updateStatus(
        contact.id,
        targetStatus,
        statusComment.trim() || undefined,
      );
      onConfirm(res.data as Contact);
    } catch {
      // silently fail
    } finally {
      setStatusUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
      <div
        className="bg-white rounded-lg max-w-md w-full shadow-xl"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleConfirm(); }
          if (e.key === 'Escape') onCancel();
        }}
      >
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold text-foreground">Change Status</h3>
            <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Move <span className="font-medium text-foreground">{contact.name}</span> to{' '}
            <span className="font-medium text-foreground">{targetLabel}</span>?
          </p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-foreground mb-1">
              Comment <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              ref={commentRef}
              value={statusComment}
              onChange={(e) => setStatusComment(e.target.value)}
              placeholder="Add a note about this status change..."
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-1">Press Enter to confirm, Shift+Enter for new line</p>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onCancel} disabled={statusUpdating}>Cancel</Button>
            <Button onClick={() => void handleConfirm()} disabled={statusUpdating}>
              {statusUpdating ? 'Updating...' : 'Confirm'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
