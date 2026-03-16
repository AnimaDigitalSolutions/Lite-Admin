'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { waitlistApi } from '@/lib/api';
import {
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const EMPTY_FORM = { email: '', name: '' };

interface AddSubscriberModalProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

export default function AddSubscriberModal({ open, onClose, onAdded }: AddSubscriberModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  if (!open) return null;

  const handleAdd = async () => {
    if (!form.email) {
      setError('Email is required.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await waitlistApi.create({ email: form.email, name: form.name || undefined });
      setForm(EMPTY_FORM);
      onAdded();
      onClose();
    } catch (err) {
      const e = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setError(e.response?.data?.error?.message ?? e.message ?? 'Failed to add entry');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Add Subscriber</h2>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <XMarkIcon className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Email *</label>
              <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="user@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Name (optional)</label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Jane Doe" />
            </div>
            {error && (
              <div className="p-3 rounded-md bg-red-50 text-red-800 border border-red-200 text-sm">{error}</div>
            )}
            <div className="flex gap-2 pt-2">
              <Button onClick={() => void handleAdd()} disabled={loading} className="flex items-center gap-2">
                <PlusIcon className="h-4 w-4" />
                {loading ? 'Adding...' : 'Add Subscriber'}
              </Button>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
