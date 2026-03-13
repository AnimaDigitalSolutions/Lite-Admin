'use client';

import { useState, useEffect } from 'react';
import { settingsApi } from './api';

const LS_KEY = 'display_timezone';

// Module-level cache to avoid repeated fetches within the same session
let cachedTz: string | null = null;
let fetchPromise: Promise<string> | null = null;

async function fetchTimezone(): Promise<string> {
  if (cachedTz) return cachedTz;

  // Read from localStorage as a fast first-pass
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) {
      cachedTz = stored;
      return stored;
    }
  }

  // Deduplicate in-flight fetches
  if (!fetchPromise) {
    fetchPromise = settingsApi
      .get()
      .then((res) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const tz = (res.data?.display_timezone as string) || 'UTC';
        cachedTz = tz;
        if (typeof window !== 'undefined') localStorage.setItem(LS_KEY, tz);
        return tz;
      })
      .catch(() => 'UTC')
      .finally(() => {
        fetchPromise = null;
      });
  }

  return fetchPromise;
}

/** Call this after saving a new timezone to force all hooks to re-read. */
export function invalidateTimezoneCache(newTz?: string) {
  cachedTz = newTz ?? null;
  if (typeof window !== 'undefined') {
    if (newTz) {
      localStorage.setItem(LS_KEY, newTz);
    } else {
      localStorage.removeItem(LS_KEY);
    }
  }
}

/**
 * Parse a SQLite UTC timestamp string (`YYYY-MM-DD HH:MM:SS`, no 'Z') into a
 * proper UTC Date.  Also handles ISO strings that already include an offset.
 */
function parseUtc(dateString: string): Date {
  if (!dateString) return new Date(NaN);
  // Already has offset or 'Z' — pass through
  if (dateString.includes('Z') || /[+-]\d{2}:\d{2}$/.test(dateString)) {
    return new Date(dateString);
  }
  // SQLite format: replace space with 'T' and append 'Z' to force UTC
  const iso = dateString.replace(' ', 'T') + 'Z';
  return new Date(iso);
}

/** Hook that provides timezone-aware date formatting. */
export function useTimezone() {
  const [tz, setTz] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(LS_KEY) || 'UTC';
    }
    return 'UTC';
  });

  useEffect(() => {
    void fetchTimezone().then((resolved) => {
      if (resolved !== tz) setTz(resolved);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const formatDate = (
    dateString: string,
    options: Intl.DateTimeFormatOptions = {},
  ): string => {
    const d = parseUtc(dateString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
      ...options,
    });
  };

  return { tz, formatDate };
}

/** Common IANA timezone options for the selector. */
export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Brussels', label: 'Brussels (CET/CEST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)' },
  { value: 'Europe/Rome', label: 'Rome (CET/CEST)' },
  { value: 'Europe/Madrid', label: 'Madrid (CET/CEST)' },
  { value: 'Europe/Zurich', label: 'Zurich (CET/CEST)' },
  { value: 'Europe/Stockholm', label: 'Stockholm (CET/CEST)' },
  { value: 'Europe/Helsinki', label: 'Helsinki (EET/EEST)' },
  { value: 'Europe/Bucharest', label: 'Bucharest (EET/EEST)' },
  { value: 'Europe/Moscow', label: 'Moscow (MSK)' },
  { value: 'America/New_York', label: 'New York (ET)' },
  { value: 'America/Chicago', label: 'Chicago (CT)' },
  { value: 'America/Denver', label: 'Denver (MT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PT)' },
  { value: 'America/Toronto', label: 'Toronto (ET)' },
  { value: 'America/Vancouver', label: 'Vancouver (PT)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Kolkata', label: 'Kolkata (IST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Seoul', label: 'Seoul (KST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT/AEST)' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEDT/AEST)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZDT/NZST)' },
];
