'use client';

import { useEffect, useState } from 'react';
import { useTimezone } from '@/lib/timezone';
import { getDisplayPrefs } from '@/lib/display-prefs';
import ProtectedLayout from '@/components/protected-layout';
import { statsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UsersIcon, EnvelopeIcon, PhotoIcon, SignalIcon } from '@heroicons/react/24/outline';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface TrendPoint {
  date: string;
  count: number;
}

interface Stats {
  contacts: {
    total: number;
    recent: string | null;
    trend: TrendPoint[];
  };
  waitlist: {
    total: number;
    recent: string | null;
    trend: TrendPoint[];
  };
  media: {
    total: number;
    recent: string | null;
  };
  system: {
    uptime: number;
    memory: { heapUsed: number };
    node_version: string;
  };
}

// Merge two sparse trend arrays into a unified date series
function mergeTrends(
  contacts: TrendPoint[],
  waitlist: TrendPoint[],
  days: number = 30
): { date: string; contacts: number; waitlist: number }[] {
  const map = new Map<string, { contacts: number; waitlist: number }>();

  // Pre-populate all days so the chart always shows the full window
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0]!;
    map.set(key, { contacts: 0, waitlist: 0 });
  }

  for (const p of contacts) {
    const entry = map.get(p.date);
    if (entry) entry.contacts = p.count;
  }
  for (const p of waitlist) {
    const entry = map.get(p.date);
    if (entry) entry.waitlist = p.count;
  }

  return Array.from(map.entries()).map(([date, v]) => ({
    date: date.slice(5), // MM-DD display
    contacts: v.contacts,
    waitlist: v.waitlist,
  }));
}

const DATE_RANGE_OPTIONS = [7, 14, 30, 90] as const;
type DateRange = typeof DATE_RANGE_OPTIONS[number];

export default function DashboardPage() {
  const { formatDate } = useTimezone();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<DateRange>(() => {
    if (typeof window === 'undefined') return 30;
    const saved = parseInt(localStorage.getItem('dashboard_date_range') ?? '', 10);
    if (DATE_RANGE_OPTIONS.includes(saved as DateRange)) return saved as DateRange;
    // Fall back to the admin-configured default
    const defaultDays = getDisplayPrefs().defaultDashboardDays;
    return (DATE_RANGE_OPTIONS.includes(defaultDays as DateRange) ? defaultDays : 30) as DateRange;
  });

  useEffect(() => {
    void loadStats(days);
  }, [days]);

  const loadStats = async (d: number) => {
    setLoading(true);
    try {
      const response = await statsApi.get(d);
      setStats(response.data);
    } catch {
      // stats stays null → error UI renders below
    } finally {
      setLoading(false);
    }
  };

  const handleDaysChange = (d: DateRange) => {
    localStorage.setItem('dashboard_date_range', String(d));
    setDays(d);
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatMemory = (bytes: number) => `${Math.round(bytes / 1024 / 1024)}MB`;

  const chartData = stats
    ? mergeTrends(stats.contacts.trend, stats.waitlist.trend, days)
    : [];

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">Overview of your platform</p>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-500">Loading...</div>
        ) : stats ? (
          <>
            {/* Stat cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
                  <EnvelopeIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.contacts.total}</div>
                  {stats.contacts.recent && (
                    <p className="text-xs text-muted-foreground">
                      Last: {formatDate(stats.contacts.recent, { hour: undefined, minute: undefined })}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Waitlist Signups</CardTitle>
                  <UsersIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.waitlist.total}</div>
                  {stats.waitlist.recent && (
                    <p className="text-xs text-muted-foreground">
                      Last: {formatDate(stats.waitlist.recent, { hour: undefined, minute: undefined })}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Media Items</CardTitle>
                  <PhotoIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.media.total}</div>
                  {stats.media.recent && (
                    <p className="text-xs text-muted-foreground">
                      Last: {formatDate(stats.media.recent, { hour: undefined, minute: undefined })}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">System Uptime</CardTitle>
                  <SignalIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatUptime(stats.system.uptime)}</div>
                  <p className="text-xs text-muted-foreground">
                    Memory: {formatMemory(stats.system.memory.heapUsed)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Activity trend chart */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>{days}-Day Activity</CardTitle>
                <div className="flex gap-1">
                  {DATE_RANGE_OPTIONS.map(d => (
                    <button
                      key={d}
                      onClick={() => handleDaysChange(d)}
                      className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                        days === d
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      interval={Math.floor(days / 7) - 1}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="contacts"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="waitlist"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="py-8 text-red-600">Failed to load statistics</div>
        )}
      </div>
    </ProtectedLayout>
  );
}
