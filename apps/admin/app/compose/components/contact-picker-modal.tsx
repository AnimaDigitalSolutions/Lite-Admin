'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  XMarkIcon,
  UsersIcon,
  MagnifyingGlassIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import type { Recipient, Contact } from '../types';
import { avatarColor } from '../types';

interface ContactPickerModalProps {
  contacts: Contact[];
  loading: boolean;
  currentRecipients: Recipient[];
  allUsedEmails: Set<string>;
  targetField: 'to' | 'cc' | 'bcc';
  onConfirm: (recipients: Recipient[]) => void;
  onClose: () => void;
}

export default function ContactPickerModal({
  contacts,
  loading,
  currentRecipients,
  allUsedEmails,
  targetField,
  onConfirm,
  onClose,
}: ContactPickerModalProps) {
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

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.company && c.company.toLowerCase().includes(q)),
    );
  }, [contacts, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Contact[]>();
    for (const c of filtered) {
      const key = c.company?.trim() || 'No Company';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    const entries = [...map.entries()].sort((a, b) => {
      if (a[0] === 'No Company') return 1;
      if (b[0] === 'No Company') return -1;
      return a[0].localeCompare(b[0]);
    });
    return entries;
  }, [filtered]);

  const currentFieldEmails = new Set(currentRecipients.map(r => r.email.toLowerCase()));
  const isUsedElsewhere = (c: Contact) => {
    const email = c.email.toLowerCase();
    return allUsedEmails.has(email) && !currentFieldEmails.has(email);
  };

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

  const handleConfirm = () => {
    const selectedContacts = contacts.filter(c => selected.has(c.id));
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
              <h3 className="text-base font-semibold text-foreground">Select Contacts</h3>
              <p className="text-xs text-muted-foreground">
                Adding to <span className="font-medium uppercase">{targetField}</span> &middot; {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-accent">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b shrink-0">
          <div className="relative">
            <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email, or company..."
              className="w-full rounded-md border border-border bg-muted pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
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
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-foreground" />
            </div>
          ) : grouped.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
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
                    <div
                      className="sticky top-0 bg-muted/95 backdrop-blur-sm flex items-center justify-between px-5 py-1.5 cursor-pointer hover:bg-accent/80 transition-colors"
                      onClick={() => toggleCollapseGroup(group)}
                    >
                      <div className="flex items-center gap-2">
                        {isCollapsed
                          ? <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          : <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        }
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group}</span>
                        <span className="text-[11px] text-muted-foreground">
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
                                : 'hover:bg-accent'
                          }`}
                        >
                          <div className={`shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-blue-600 border-blue-600'
                              : usedElsewhere
                                ? 'border-border bg-accent'
                                : 'border-border hover:border-blue-400'
                          }`}>
                            {isSelected && <CheckIcon className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                          </div>
                          <span className={`inline-flex items-center justify-center h-9 w-9 rounded-full text-white text-sm font-bold shrink-0 ${avatarColor(c.name)}`}>
                            {c.name.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-foreground truncate">{c.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                          </div>
                          {usedElsewhere && (
                            <span className="text-[10px] text-muted-foreground shrink-0">In other field</span>
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
        <div className="flex items-center justify-between px-5 py-3 border-t bg-muted rounded-b-xl shrink-0">
          <span className="text-sm text-muted-foreground">
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
