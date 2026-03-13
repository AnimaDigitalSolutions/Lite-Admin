'use client';

import { useState, useEffect } from 'react';

export interface DisplayPrefs {
  showGeoInfo: boolean;
  truncateEmails: boolean;
  defaultDashboardDays: 7 | 14 | 30 | 90;
  mediaBasePath: string;
  maxUploadSizeMB: number;
}

const DEFAULTS: DisplayPrefs = {
  showGeoInfo: true,
  truncateEmails: true,
  defaultDashboardDays: 30,
  mediaBasePath: '/uploads/portfolio',
  maxUploadSizeMB: 10,
};

const LS_KEY = 'display_prefs';

function loadPrefs(): DisplayPrefs {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) return { ...DEFAULTS, ...(JSON.parse(stored) as Partial<DisplayPrefs>) };
  } catch {
    // ignore parse errors
  }
  return { ...DEFAULTS };
}

function savePrefs(prefs: DisplayPrefs) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LS_KEY, JSON.stringify(prefs));
  }
}

/** Read-only access — use this in pages that just need to check a pref. */
export function getDisplayPrefs(): DisplayPrefs {
  return loadPrefs();
}

/** Hook that provides reactive access + setter for display preferences. */
export function useDisplayPrefs() {
  const [prefs, setPrefsState] = useState<DisplayPrefs>(() => loadPrefs());

  useEffect(() => {
    // Sync in case another tab changed prefs
    setPrefsState(loadPrefs());
  }, []);

  const setPrefs = (update: Partial<DisplayPrefs>) => {
    const next = { ...prefs, ...update };
    savePrefs(next);
    setPrefsState(next);
  };

  return { prefs, setPrefs };
}
