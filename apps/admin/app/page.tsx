'use client';

import { useEffect, useState } from 'react';
import ProtectedLayout from '@/components/protected-layout';
import { statsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Mail, Image as ImageIcon, Activity } from 'lucide-react';

interface Stats {
  contacts: {
    total: number;
    recent: string | null;
  };
  waitlist: {
    total: number;
    recent: string | null;
  };
  media: {
    total: number;
    recent: string | null;
  };
  system: {
    uptime: number;
    memory: any;
    node_version: string;
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await statsApi.get();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}d ${hours}h`;
  };

  const formatMemory = (bytes: number) => {
    return `${Math.round(bytes / 1024 / 1024)}MB`;
  };

  return (
    <ProtectedLayout>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">Welcome to your admin dashboard</p>

        {loading ? (
          <div className="mt-8">Loading stats...</div>
        ) : stats ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Contacts
                </CardTitle>
                <Mail className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.contacts.total}</div>
                {stats.contacts.recent && (
                  <p className="text-xs text-muted-foreground">
                    Last: {new Date(stats.contacts.recent).toLocaleDateString()}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Waitlist Signups
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.waitlist.total}</div>
                {stats.waitlist.recent && (
                  <p className="text-xs text-muted-foreground">
                    Last: {new Date(stats.waitlist.recent).toLocaleDateString()}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Media Items
                </CardTitle>
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.media.total}</div>
                {stats.media.recent && (
                  <p className="text-xs text-muted-foreground">
                    Last: {new Date(stats.media.recent).toLocaleDateString()}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  System Uptime
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatUptime(stats.system.uptime)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Memory: {formatMemory(stats.system.memory.heapUsed)}
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="mt-8 text-red-600">Failed to load statistics</div>
        )}
      </div>
    </ProtectedLayout>
  );
}