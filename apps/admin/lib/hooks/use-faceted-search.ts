'use client';

import { useState, useRef, useMemo } from 'react';

export interface FilterSuggestion {
  token: string;
  label: string;
}

interface UseFacetedSearchOptions {
  suggestions: readonly FilterSuggestion[];
}

export function parseSearch(raw: string) {
  const tokens = new Set<string>();
  const negated = new Set<string>();
  const textParts: string[] = [];
  for (const part of raw.split(/\s+/)) {
    if (/^(has|is):[\w-]+$/i.test(part)) {
      tokens.add(part.toLowerCase());
    } else if (/^-(has|is):[\w-]+$/i.test(part)) {
      negated.add(part.slice(1).toLowerCase());
    } else if (part) {
      textParts.push(part);
    }
  }
  return { tokens, negated, text: textParts.join(' ') };
}

export function useFacetedSearch({ suggestions }: UseFacetedSearchOptions) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { tokens: activeFilters, negated: negatedFilters, text: searchText } = useMemo(
    () => parseSearch(searchTerm),
    [searchTerm],
  );

  const testFilter = (key: string): boolean | null => {
    if (activeFilters.has(key)) return true;
    if (negatedFilters.has(key)) return false;
    return null;
  };

  const toggleFilter = (token: string, e?: React.MouseEvent) => {
    const additive = e?.ctrlKey || e?.metaKey;
    const { tokens, negated, text } = parseSearch(searchTerm);
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const negEscaped = `-${escaped}`;

    if (tokens.has(token)) {
      const replaced = searchTerm.replace(new RegExp(`(?<=^|\\s)${escaped}(?=\\s|$)`, 'gi'), `-${token}`);
      setSearchTerm(replaced.trim());
    } else if (negated.has(token)) {
      setSearchTerm(searchTerm.replace(new RegExp(`\\s*${negEscaped}\\s*`, 'gi'), ' ').trim());
    } else if (additive) {
      setSearchTerm((searchTerm + ' ' + token).trim());
    } else {
      setSearchTerm((token + (text ? ' ' + text : '')).trim());
    }
  };

  const getFilteredSuggestions = () => {
    const words = searchTerm.split(/\s+/);
    const lastWord = words[words.length - 1]?.toLowerCase() ?? '';
    if (!lastWord || (!lastWord.startsWith('i') && !lastWord.startsWith('h') && !lastWord.startsWith('-'))) return [];
    const { tokens, negated } = parseSearch(searchTerm);
    return suggestions.filter(s => {
      const bare = s.token.replace(/^-/, '');
      const isNeg = s.token.startsWith('-');
      if (isNeg ? negated.has(bare) : tokens.has(bare)) return false;
      return s.token.startsWith(lastWord);
    });
  };

  const filteredSuggestions = showSuggestions ? getFilteredSuggestions() : [];

  const applySuggestion = (token: string) => {
    const words = searchTerm.split(/\s+/);
    words[words.length - 1] = token;
    setSearchTerm(words.join(' ') + ' ');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const onInputChange = (value: string) => {
    setSearchTerm(value);
    setShowSuggestions(true);
    setSuggestionIndex(0);
  };

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (!filteredSuggestions.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSuggestionIndex(i => Math.min(i + 1, filteredSuggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSuggestionIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && filteredSuggestions[suggestionIndex]) { e.preventDefault(); applySuggestion(filteredSuggestions[suggestionIndex].token); }
    else if (e.key === 'Escape') setShowSuggestions(false);
  };

  return {
    searchTerm,
    setSearchTerm,
    searchText,
    activeFilters,
    negatedFilters,
    testFilter,
    toggleFilter,
    // Autocomplete
    showSuggestions,
    setShowSuggestions,
    suggestionIndex,
    suggestionsRef,
    inputRef,
    filteredSuggestions,
    applySuggestion,
    onInputChange,
    onInputKeyDown,
  };
}
