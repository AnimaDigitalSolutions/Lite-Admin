'use client';

import { useState, useEffect } from 'react';
import ProtectedLayout from '@/components/protected-layout';
import { statsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface TrendPoint {
  date: string;
  count: number;
}

interface Stats {
  contacts: { total: number; trend: TrendPoint[] };
  waitlist: { total: number; trend: TrendPoint[] };
  media: { total: number };
  system: { uptime: number; memory: { heapUsed: number; rss: number; heapTotal: number }; node_version: string };
}

function fillDays(trend: TrendPoint[], days: number): { date: string; count: number }[] {
  const map = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    map.set(d.toISOString().split('T')[0]!, 0);
  }
  for (const p of trend) map.set(p.date, p.count);
  return Array.from(map.entries()).map(([date, count]) => ({ date: date.slice(5), count }));
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await statsApi.get();
      setStats(response.data);
    } catch {
      // stats stays null → error UI renders below
    } finally {
      setLoading(false);
    }
  };

  const formatMemory = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`;

  if (loading) {
    return (
      <ProtectedLayout>
        <div className="py-12 text-center text-gray-500">Loading statistics...</div>
      </ProtectedLayout>
    );
  }

  if (!stats) {
    return (
      <ProtectedLayout>
        <div className="py-8 text-red-600">Failed to load statistics</div>
      </ProtectedLayout>
    );
  }

  const contactData = fillDays(stats.contacts.trend, 30);
  const waitlistData = fillDays(stats.waitlist.trend, 30);

  const mem = stats.system.memory;
  const memBreakdown = [
    { label: 'Heap Used', value: mem.heapUsed },
    { label: 'Heap Total', value: mem.heapTotal },
    { label: 'RSS', value: mem.rss },
  ];

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Statistics</h1>
          <p className="mt-2 text-gray-600">30-day activity breakdowns</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Contacts', value: stats.contacts.total, color: 'text-blue-600' },
            { label: 'Waitlist Signups', value: stats.waitlist.total, color: 'text-green-600' },
            { label: 'Media Items', value: stats.media.total, color: 'text-purple-600' },
            { label: 'Node', value: stats.system.node_version, color: 'text-gray-600' },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <CardContent className="pt-6">
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
                <div className="text-sm text-gray-500 mt-1">{label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Contacts trend */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Form Submissions — Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={contactData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} interval={4} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="count" name="Contacts" radius={[3, 3, 0, 0]}>
                  {contactData.map((_, i) => (
                    <Cell key={i} fill="#3b82f6" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Waitlist trend */}
        <Card>
          <CardHeader>
            <CardTitle>Waitlist Signups — Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={waitlistData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} interval={4} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="count" name="Signups" radius={[3, 3, 0, 0]}>
                  {waitlistData.map((_, i) => (
                    <Cell key={i} fill="#10b981" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Memory breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Memory Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {memBreakdown.map(({ label, value }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-28 text-sm text-gray-600">{label}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${Math.min(100, (value / mem.rss) * 100)}%` }}
                    />
                  </div>
                  <div className="w-20 text-right text-sm font-medium text-gray-700">
                    {formatMemory(value)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedLayout>
  );
}
