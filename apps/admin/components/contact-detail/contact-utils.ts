export type ContactStatus = 'new' | 'reviewed' | 'contacted' | 'qualified' | 'proposal_sent' | 'won' | 'lost' | 'archived';

export type NoteSubtype = 'note' | 'todo' | 'message' | 'reply';

export interface Contact {
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

export interface ContactNote {
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

export const PIPELINE_STAGES: { value: ContactStatus; label: string; color: string }[] = [
  { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-800' },
  { value: 'reviewed', label: 'Reviewed', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'contacted', label: 'Contacted', color: 'bg-cyan-100 text-cyan-800' },
  { value: 'qualified', label: 'Qualified', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'proposal_sent', label: 'Proposal Sent', color: 'bg-amber-100 text-amber-800' },
  { value: 'won', label: 'Won', color: 'bg-green-100 text-green-800' },
  { value: 'lost', label: 'Lost', color: 'bg-red-100 text-red-800' },
  { value: 'archived', label: 'Archived', color: 'bg-gray-100 text-gray-600' },
];

export const NOTE_COLORS: { value: string; label: string; bg: string; border: string; dot: string }[] = [
  { value: 'gray',  label: 'Default',  bg: 'bg-white border-gray-150', border: 'border-gray-200', dot: 'bg-gray-400' },
  { value: 'blue',  label: 'Info',      bg: 'bg-blue-50',               border: 'border-blue-200', dot: 'bg-blue-400' },
  { value: 'green', label: 'Sent',      bg: 'bg-emerald-50',            border: 'border-emerald-200', dot: 'bg-emerald-400' },
  { value: 'amber', label: 'Follow-up', bg: 'bg-amber-50',              border: 'border-amber-200', dot: 'bg-amber-400' },
  { value: 'red',   label: 'Important', bg: 'bg-red-50',                border: 'border-red-200', dot: 'bg-red-400' },
];

export function getStatusBadge(status?: string) {
  const stage = PIPELINE_STAGES.find(s => s.value === status) || PIPELINE_STAGES[0];
  return stage;
}

export function getNoteStyle(color?: string) {
  return NOTE_COLORS.find(c => c.value === color) || NOTE_COLORS[0];
}

export function countryFlag(iso: string) {
  if (!iso || iso.length !== 2) return '';
  return String.fromCodePoint(...[...iso.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0)));
}

export function getProjectTypeColor(type?: string) {
  const colors: Record<string, string> = {
    web: 'bg-blue-100 text-blue-800',
    mobile: 'bg-green-100 text-green-800',
    desktop: 'bg-purple-100 text-purple-800',
    consulting: 'bg-yellow-100 text-yellow-800',
    other: 'bg-gray-100 text-gray-800',
  };
  return colors[type || 'other'] || colors.other;
}

export function openDatePicker(current: string, onChange: (val: string) => void, e?: React.MouseEvent) {
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
  setTimeout(cleanup, 60000);
}
