'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { XMarkIcon, UsersIcon } from '@heroicons/react/24/outline';
import type { Recipient, Contact } from '../types';
import { avatarColor } from '../types';

interface RecipientFieldProps {
  label: string;
  recipients: Recipient[];
  setRecipients: (r: Recipient[]) => void;
  contacts: Contact[];
  allUsedEmails: Set<string>;
  onOpenPicker: () => void;
  required?: boolean;
  onCollapse?: () => void;
}

export default function RecipientField({
  label,
  recipients,
  setRecipients,
  contacts,
  allUsedEmails,
  onOpenPicker,
  required,
  onCollapse,
}: RecipientFieldProps) {
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
