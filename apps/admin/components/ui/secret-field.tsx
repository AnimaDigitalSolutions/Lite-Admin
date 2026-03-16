'use client';

import { useState } from 'react';
import { useCopyToClipboard } from '@/lib/hooks/use-copy-to-clipboard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  EyeIcon,
  EyeSlashIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';

interface SecretFieldProps {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder?: string;
}

export function SecretField({ value, onChange, label, placeholder }: SecretFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const { copy, isCopied } = useCopyToClipboard();
  return (
    <div>
      <Label className="text-sm font-medium">{label}</Label>
      <div className="mt-1.5 flex gap-1.5">
        <Input
          type={revealed ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? '••••••••'}
          className="font-mono text-sm"
        />
        <button type="button" onClick={() => setRevealed(r => !r)}
          className="rounded border px-2 text-muted-foreground hover:bg-accent" title={revealed ? 'Hide' : 'Reveal'}>
          {revealed ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
        </button>
        <button type="button" onClick={() => void copy(value, label)}
          className="rounded border px-2 text-muted-foreground hover:bg-accent" title="Copy">
          <ClipboardDocumentIcon className={`h-4 w-4 ${isCopied(label) ? 'text-emerald-600' : ''}`} />
        </button>
      </div>
    </div>
  );
}
