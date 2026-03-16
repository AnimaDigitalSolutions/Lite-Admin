'use client';

import { useState } from 'react';
import { submissionsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { XMarkIcon } from '@heroicons/react/24/outline';

type ProjectType = 'web' | 'mobile' | 'erp' | 'consulting' | 'other';

const EMPTY_FORM = {
  name: '',
  email: '',
  company: '',
  project_type: 'web' as ProjectType,
  message: '',
};

interface AddContactModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function AddContactModal({ open, onClose, onCreated }: AddContactModalProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.message) {
      setError('Name, email, and message are required.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await submissionsApi.create(form);
      onClose();
      setForm(EMPTY_FORM);
      onCreated();
    } catch (err) {
      const e = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setError(e.response?.data?.error?.message ?? e.message ?? 'Failed to add contact');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Add Contact</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Name *</label>
            <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Email *</label>
            <Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Company</label>
            <Input value={form.company} onChange={(e) => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Optional" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Project Type</label>
            <select
              value={form.project_type}
              onChange={(e) => setForm(f => ({ ...f, project_type: e.target.value as ProjectType }))}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="web">Web Application</option>
              <option value="mobile">Mobile App</option>
              <option value="erp">ERP System</option>
              <option value="consulting">Consulting</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Message *</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Contact message..."
            />
          </div>
          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => void handleSubmit()} disabled={loading}>
              {loading ? 'Adding...' : 'Add Contact'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
