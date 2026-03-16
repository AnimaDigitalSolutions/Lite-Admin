'use client';

import { useState, useCallback, useRef } from 'react';

interface UseCopyToClipboardOptions {
  timeout?: number;
}

export function useCopyToClipboard(options?: UseCopyToClipboardOptions) {
  const { timeout = 2000 } = options ?? {};
  const [copiedId, setCopiedId] = useState<string | number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(async (text: string, id?: string | number) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id ?? text);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopiedId(null), timeout);
  }, [timeout]);

  const isCopied = useCallback((id: string | number) => copiedId === id, [copiedId]);

  return { copiedId, copy, isCopied };
}
