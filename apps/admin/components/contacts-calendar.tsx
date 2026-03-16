'use client';

import { useRef, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
} from '@heroicons/react/24/outline';
import { getStatusBadge } from '@/components/contact-detail-panel';
import { highlightMatch } from '@/lib/utils';

type ContactStatus = 'new' | 'reviewed' | 'contacted' | 'qualified' | 'proposal_sent' | 'won' | 'lost' | 'archived';

interface Contact {
  id: string;
  name: string;
  email: string;
  company?: string;
  project_type?: string;
  message: string;
  submitted_at: string;
  status?: ContactStatus;
  follow_up_at?: string;
}

interface StatusChange {
  status: string;
  changed_at: string;
}

interface ContactsCalendarProps {
  calendarMonth: { year: number; month: number };
  setCalendarMonth: React.Dispatch<React.SetStateAction<{ year: number; month: number }>>;
  contacts: Contact[];
  onSelectContact: (contact: Contact) => void;
  selectedContactId?: string;
  searchTerm?: string;
  statusHistory?: Record<number, StatusChange[]>;
}

// Status → bar color mapping
const STATUS_BAR_COLORS: Record<string, string> = {
  new: 'bg-blue-400',
  reviewed: 'bg-indigo-400',
  contacted: 'bg-cyan-400',
  qualified: 'bg-emerald-400',
  proposal_sent: 'bg-amber-400',
  won: 'bg-green-500',
  lost: 'bg-red-400',
  archived: 'bg-gray-400',
};

const TERMINAL_STATUSES = new Set(['won', 'lost', 'archived']);

const ZOOM_LEVELS = [8, 10, 14, 18, 24, 32, 48, 64, 96];
const WINDOW_DAYS = [180, 150, 90, 90, 60, 30, 21, 14, 7];
const DEFAULT_ZOOM = 3; // index 3 = 18px/day, 90 days
const ITEMS_PER_PAGE = 10;
const ROW_HEIGHT = 36;
const LABEL_WIDTH = 220;

type TimeFilter = 'last30' | 'last90' | 'month' | 'all';

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function toDateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDate(s: string): Date {
  const parts = s.split(/[T ]/)[0].split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

export default function ContactsCalendar({
  calendarMonth,
  setCalendarMonth,
  contacts,
  onSelectContact,
  selectedContactId,
  searchTerm,
  statusHistory = {},
}: ContactsCalendarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayLineRef = useRef<HTMLDivElement>(null);

  const { year, month } = calendarMonth;

  // Zoom state
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM);
  const DAY_WIDTH = ZOOM_LEVELS[zoomIndex];

  // Time filter
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('last30');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  const today = useMemo(() => toDateOnly(new Date()), []);

  // Filter contacts by time range
  const timeFilteredContacts = useMemo(() => {
    if (timeFilter === 'all') return contacts;

    const now = new Date();
    let cutoff: Date;

    if (timeFilter === 'last30') {
      cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    } else if (timeFilter === 'last90') {
      cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90);
    } else {
      // 'month' — filter by the selected calendar month
      cutoff = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);
      return contacts.filter(c => {
        const d = parseDate(c.submitted_at);
        return d >= cutoff && d <= monthEnd;
      });
    }

    return contacts.filter(c => parseDate(c.submitted_at) >= cutoff);
  }, [contacts, timeFilter, year, month]);

  // Sort contacts by submitted_at
  const sortedContacts = useMemo(() => {
    return [...timeFilteredContacts].sort((a, b) => {
      const da = parseDate(a.submitted_at).getTime();
      const db = parseDate(b.submitted_at).getTime();
      return da - db;
    });
  }, [timeFilteredContacts]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedContacts.length / ITEMS_PER_PAGE));
  const paginatedContacts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedContacts.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedContacts, currentPage]);

  // Reset page when filters change (use contact IDs to avoid resetting on parent re-render)
  const contactIds = useMemo(() => contacts.map(c => c.id).join(','), [contacts]);
  useEffect(() => {
    setCurrentPage(1);
  }, [timeFilter, contactIds]);

  // Timeline window: size depends on zoom level (day-based)
  const windowDays = WINDOW_DAYS[zoomIndex];
  const halfDays = Math.floor(windowDays / 2);
  const centerDate = new Date(year, month, 15);
  const windowStart = useMemo(() => {
    const d = new Date(centerDate);
    d.setDate(d.getDate() - halfDays);
    return toDateOnly(d);
  }, [year, month, halfDays]);
  const windowEnd = useMemo(() => {
    const d = new Date(centerDate);
    d.setDate(d.getDate() + (windowDays - halfDays));
    return toDateOnly(d);
  }, [year, month, windowDays, halfDays]);
  const totalDays = daysBetween(windowStart, windowEnd) + 1;

  // Build week columns
  const weeks = useMemo(() => {
    const result: { date: Date; label: string; monthLabel?: string }[] = [];
    const cursor = new Date(windowStart);
    cursor.setDate(cursor.getDate() - cursor.getDay());

    let lastMonth = -1;
    while (cursor <= windowEnd) {
      const d = new Date(cursor);
      const showMonth = d.getMonth() !== lastMonth;
      result.push({
        date: d,
        label: String(d.getDate()),
        monthLabel: showMonth ? d.toLocaleDateString('en-US', { month: 'short', year: d.getMonth() === 0 ? 'numeric' : undefined }) : undefined,
      });
      lastMonth = d.getMonth();
      cursor.setDate(cursor.getDate() + 7);
    }
    return result;
  }, [windowStart, windowEnd]);

  // Scroll to today on mount
  useEffect(() => {
    if (todayLineRef.current && scrollRef.current) {
      const todayOffsetPx = daysBetween(windowStart, today) * DAY_WIDTH;
      scrollRef.current.scrollLeft = Math.max(0, todayOffsetPx - scrollRef.current.clientWidth / 2);
    }
  }, [windowStart, today, DAY_WIDTH]);

  const prevPeriod = () => {
    // Step by roughly half the window size for smooth panning
    const stepDays = Math.max(7, Math.floor(windowDays / 2));
    setCalendarMonth(p => {
      const center = new Date(p.year, p.month, 15);
      center.setDate(center.getDate() - stepDays);
      return { year: center.getFullYear(), month: center.getMonth() };
    });
  };
  const nextPeriod = () => {
    const stepDays = Math.max(7, Math.floor(windowDays / 2));
    setCalendarMonth(p => {
      const center = new Date(p.year, p.month, 15);
      center.setDate(center.getDate() + stepDays);
      return { year: center.getFullYear(), month: center.getMonth() };
    });
  };
  const goToday = () => {
    const n = new Date();
    setCalendarMonth({ year: n.getFullYear(), month: n.getMonth() });
  };

  // Show actual visible date range in the header
  const headerLabel = useMemo(() => {
    const startMonth = windowStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const endMonth = windowEnd.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    if (windowDays <= 14) {
      // Weekly view: show exact date range
      const startStr = windowStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endStr = windowEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${startStr} – ${endStr}`;
    }
    if (startMonth === endMonth) return startMonth;
    return `${startMonth} – ${endMonth}`;
  }, [windowStart, windowEnd, windowDays]);

  // Compute today marker position
  const todayOffset = daysBetween(windowStart, today);
  const showTodayLine = todayOffset >= 0 && todayOffset <= totalDays;

  const zoomIn = () => setZoomIndex(prev => Math.min(prev + 1, ZOOM_LEVELS.length - 1));
  const zoomOut = () => setZoomIndex(prev => Math.max(prev - 1, 0));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3">
          {/* Top row: navigation + legend */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={prevPeriod}>
                <ChevronLeftIcon className="h-4 w-4" />
              </Button>
              <CardTitle className="min-w-[180px] text-center text-sm">{headerLabel}</CardTitle>
              <Button variant="outline" size="sm" onClick={nextPeriod}>
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={goToday} className="text-xs">
                Today
              </Button>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
              {Object.entries(STATUS_BAR_COLORS).map(([status, color]) => (
                <span key={status} className="flex items-center gap-1">
                  <span className={`h-2 w-6 rounded ${color} inline-block ${TERMINAL_STATUSES.has(status) ? 'opacity-70' : ''}`} />
                  {status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </span>
              ))}
            </div>
          </div>

          {/* Bottom row: time filter + zoom + pagination info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Show:</span>
              <div className="flex rounded-md border border-gray-200 overflow-hidden">
                {([
                  { value: 'last30' as TimeFilter, label: 'Last 30 days' },
                  { value: 'last90' as TimeFilter, label: 'Last 90 days' },
                  { value: 'month' as TimeFilter, label: 'This month' },
                  { value: 'all' as TimeFilter, label: 'All' },
                ]).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTimeFilter(value)}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      timeFilter === value
                        ? 'bg-gray-900 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-gray-400 ml-2">
                {sortedContacts.length} contacts
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Zoom controls */}
              <span className="text-xs text-gray-500 font-medium">Zoom:</span>
              <Button
                variant="outline"
                size="sm"
                onClick={zoomOut}
                disabled={zoomIndex === 0}
                className="h-7 w-7 p-0"
              >
                <MagnifyingGlassMinusIcon className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-gray-400 w-8 text-center">
                {Math.round((DAY_WIDTH / ZOOM_LEVELS[DEFAULT_ZOOM]) * 100)}%
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={zoomIn}
                disabled={zoomIndex === ZOOM_LEVELS.length - 1}
                className="h-7 w-7 p-0"
              >
                <MagnifyingGlassPlusIcon className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {sortedContacts.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No contacts to display</div>
        ) : (
          <>
            <div className="flex border-t border-gray-200">
              {/* Fixed left column — contact labels */}
              <div className="shrink-0 border-r border-gray-200 z-10" style={{ width: LABEL_WIDTH }}>
                {/* Header spacer */}
                <div className="h-[52px] border-b border-gray-200 px-3 flex items-end pb-1 bg-white">
                  <span className="text-xs font-medium text-gray-500">Contact</span>
                </div>
                {/* Contact rows */}
                {paginatedContacts.map((contact, idx) => {
                  const isSelected = selectedContactId === contact.id;
                  const badge = getStatusBadge(contact.status);
                  return (
                    <div
                      key={contact.id}
                      onClick={() => onSelectContact(contact)}
                      className={`flex items-center gap-2 px-3 cursor-pointer transition-colors ${
                        isSelected ? 'bg-amber-100 relative z-50 border-l-[3px] border-l-amber-400' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                      } hover:bg-gray-100`}
                      style={{ height: ROW_HEIGHT }}
                    >
                      <span className={`h-2 w-2 rounded-full shrink-0 ${STATUS_BAR_COLORS[contact.status || 'new']}`} />
                      <span className="text-sm truncate flex-1 font-medium">{highlightMatch(contact.name, searchTerm)}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Scrollable timeline area */}
              <div ref={scrollRef} className="overflow-x-auto flex-1">
                <div style={{ width: totalDays * DAY_WIDTH, minWidth: '100%' }} className="relative">
                  {/* Timeline header — month labels + week ticks */}
                  <div className="h-[52px] border-b border-gray-200 relative">
                    {/* Month labels */}
                    {(() => {
                      const months: { label: string; startPx: number; widthPx: number }[] = [];
                      let cursor = new Date(windowStart);
                      while (cursor <= windowEnd) {
                        const mStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
                        const mEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
                        const clampStart = mStart < windowStart ? windowStart : mStart;
                        const clampEnd = mEnd > windowEnd ? windowEnd : mEnd;
                        const startPx = daysBetween(windowStart, clampStart) * DAY_WIDTH;
                        const widthPx = (daysBetween(clampStart, clampEnd) + 1) * DAY_WIDTH;
                        months.push({
                          label: mStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
                          startPx,
                          widthPx,
                        });
                        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
                      }
                      return months.map((m, i) => (
                        <div
                          key={i}
                          className="absolute top-0 h-6 flex items-center border-r border-gray-200"
                          style={{ left: m.startPx, width: m.widthPx }}
                        >
                          <span className="text-xs font-medium text-gray-600 px-2 truncate">{m.label}</span>
                        </div>
                      ));
                    })()}
                    {/* Week tick marks */}
                    {weeks.map((w, i) => {
                      const offset = daysBetween(windowStart, w.date);
                      if (offset < 0) return null;
                      return (
                        <div
                          key={i}
                          className="absolute bottom-0 h-5 border-l border-gray-200 flex items-end"
                          style={{ left: offset * DAY_WIDTH }}
                        >
                          <span className="text-[10px] text-gray-400 pl-1">{w.label}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Today vertical line */}
                  {showTodayLine && (
                    <div
                      ref={todayLineRef}
                      className="absolute top-0 bottom-0 w-px bg-red-400 z-20 pointer-events-none"
                      style={{ left: todayOffset * DAY_WIDTH }}
                    >
                      <div className="absolute -top-0 -left-[3px] w-[7px] h-[7px] rounded-full bg-red-400" />
                    </div>
                  )}

                  {/* Contact rows with bars */}
                  {paginatedContacts.map((contact, idx) => {
                    const isSelected = selectedContactId === contact.id;
                    const submitDate = parseDate(contact.submitted_at);
                    const currentStatus = contact.status || 'new';

                    const barStartDate = submitDate < windowStart ? windowStart : submitDate;
                    const barEndDate = today > windowEnd ? windowEnd : today;

                    const startPx = daysBetween(windowStart, barStartDate) * DAY_WIDTH;
                    const totalBarDays = Math.max(1, daysBetween(barStartDate, barEndDate) + 1);
                    const totalWidthPx = totalBarDays * DAY_WIDTH;

                    // Build segments from status history
                    const history = statusHistory[Number(contact.id)];
                    let segments: { status: string; leftPx: number; widthPx: number }[];

                    if (history && history.length > 0) {
                      // Build timeline: starts as "new" at submitted_at, then each change
                      const transitions: { status: string; from: Date; to: Date }[] = [];
                      let prevStatus = 'new';
                      let prevDate = barStartDate;

                      for (const change of history) {
                        const changeDate = parseDate(change.changed_at);
                        // Clamp to visible window
                        const clampedFrom = prevDate < windowStart ? windowStart : prevDate;
                        const clampedTo = changeDate > barEndDate ? barEndDate : changeDate;
                        if (clampedFrom < clampedTo) {
                          transitions.push({ status: prevStatus, from: clampedFrom, to: clampedTo });
                        }
                        prevStatus = change.status;
                        prevDate = changeDate;
                      }
                      // Final segment: last status to today
                      const clampedFrom = prevDate < windowStart ? windowStart : prevDate;
                      if (clampedFrom <= barEndDate) {
                        transitions.push({ status: prevStatus, from: clampedFrom, to: barEndDate });
                      }

                      segments = transitions.map(t => {
                        const segStartPx = daysBetween(windowStart, t.from) * DAY_WIDTH;
                        const segDays = Math.max(1, daysBetween(t.from, t.to) + 1);
                        return {
                          status: t.status,
                          leftPx: segStartPx,
                          widthPx: segDays * DAY_WIDTH,
                        };
                      });
                    } else {
                      // No history — single bar with current status
                      segments = [{
                        status: currentStatus,
                        leftPx: startPx,
                        widthPx: Math.max(DAY_WIDTH, totalWidthPx),
                      }];
                    }

                    // Follow-up marker
                    let followUpPx: number | null = null;
                    if (contact.follow_up_at) {
                      const fuDate = parseDate(contact.follow_up_at);
                      const fuOffset = daysBetween(windowStart, fuDate);
                      if (fuOffset >= 0 && fuOffset <= totalDays) {
                        followUpPx = fuOffset * DAY_WIDTH;
                      }
                    }

                    return (
                      <div
                        key={contact.id}
                        className={`relative ${
                          isSelected ? 'bg-amber-100 z-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                        }`}
                        style={{ height: ROW_HEIGHT }}
                      >
                        {/* Multi-segment bar */}
                        {segments.map((seg, si) => {
                          const isTerminal = TERMINAL_STATUSES.has(seg.status);
                          const barColor = STATUS_BAR_COLORS[seg.status] || STATUS_BAR_COLORS.new;
                          const isFirst = si === 0;
                          const isLast = si === segments.length - 1;
                          const roundedClass = segments.length === 1
                            ? 'rounded-full'
                            : isFirst ? 'rounded-l-full'
                            : isLast ? 'rounded-r-full'
                            : '';

                          return (
                            <div
                              key={si}
                              className={`absolute top-[10px] h-4 ${roundedClass} ${barColor} ${
                                isTerminal ? 'opacity-70' : 'opacity-90'
                              } cursor-pointer hover:opacity-100 transition-opacity`}
                              style={{ left: Math.max(0, seg.leftPx), width: Math.max(4, seg.widthPx) }}
                              onClick={() => onSelectContact(contact)}
                              title={`${contact.name} — ${seg.status.replace('_', ' ')}`}
                            />
                          );
                        })}

                        {/* Name label overlay on top of bar */}
                        {totalWidthPx > 80 && (
                          <div
                            className="absolute top-[10px] h-4 flex items-center pointer-events-none z-[1]"
                            style={{ left: Math.max(0, startPx), width: totalWidthPx }}
                          >
                            <span className="text-[10px] text-white font-medium px-2 truncate drop-shadow-sm">
                              {contact.name}
                            </span>
                          </div>
                        )}

                        {/* Follow-up diamond marker */}
                        {followUpPx !== null && (
                          <div
                            className="absolute top-[11px] w-3 h-3 bg-red-500 rotate-45 rounded-sm z-10 cursor-pointer"
                            style={{ left: followUpPx - 6 }}
                            onClick={() => onSelectContact(contact)}
                            title={`Follow-up: ${contact.follow_up_at?.split('T')[0]}`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 py-3 border-t border-gray-200">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </Button>
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
