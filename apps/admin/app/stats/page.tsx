'use client';

import ProtectedLayout from '@/components/protected-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Calendar,
  Globe,
  Zap
} from 'lucide-react';

export default function StatsPage() {
  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Advanced Statistics</h1>
          <p className="mt-2 text-gray-600">Comprehensive analytics and reporting dashboard</p>
        </div>

        {/* Coming Soon Banner */}
        <Card className="border-2 border-dashed border-blue-200 bg-blue-50">
          <CardContent className="p-8 text-center">
            <BarChart3 className="mx-auto h-16 w-16 text-blue-400 mb-4" />
            <h2 className="text-xl font-semibold text-blue-900 mb-2">Advanced Analytics Coming Soon</h2>
            <p className="text-blue-700 mb-4">
              We&apos;re building comprehensive analytics features including charts, trends, and detailed reporting.
            </p>
            <div className="text-sm text-blue-600">
              Expected features: Real-time charts, conversion funnels, geographic data, and exportable reports
            </div>
          </CardContent>
        </Card>

        {/* Placeholder Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Conversion Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
              </div>
              <div className="mt-4 text-sm text-gray-500">
                Track form submission rates and user engagement
              </div>
            </CardContent>
          </Card>

          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Behavior
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-4/5"></div>
              </div>
              <div className="mt-4 text-sm text-gray-500">
                Analyze user paths and interaction patterns
              </div>
            </CardContent>
          </Card>

          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Time-based Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded animate-pulse w-full"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-3/5"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-4/5"></div>
              </div>
              <div className="mt-4 text-sm text-gray-500">
                View trends over time and seasonal patterns
              </div>
            </CardContent>
          </Card>

          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Geographic Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-full"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
              </div>
              <div className="mt-4 text-sm text-gray-500">
                See where your visitors are coming from
              </div>
            </CardContent>
          </Card>

          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Performance Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-4/5"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-3/5"></div>
              </div>
              <div className="mt-4 text-sm text-gray-500">
                Monitor system performance and response times
              </div>
            </CardContent>
          </Card>

          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Custom Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded animate-pulse w-full"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
              </div>
              <div className="mt-4 text-sm text-gray-500">
                Generate custom reports for specific metrics
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Roadmap */}
        <Card>
          <CardHeader>
            <CardTitle>Statistics Roadmap</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <div className="font-medium">Real-time Dashboard</div>
                  <div className="text-sm text-gray-600">Live metrics and automatic refresh</div>
                </div>
                <div className="text-sm text-blue-600 font-medium">Planned</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div className="flex-1">
                  <div className="font-medium">Interactive Charts</div>
                  <div className="text-sm text-gray-600">Recharts integration with drill-down capabilities</div>
                </div>
                <div className="text-sm text-green-600 font-medium">In Progress</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <div className="flex-1">
                  <div className="font-medium">Export & Scheduling</div>
                  <div className="text-sm text-gray-600">Automated reports and custom export formats</div>
                </div>
                <div className="text-sm text-purple-600 font-medium">Future</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                <div className="flex-1">
                  <div className="font-medium">AI Insights</div>
                  <div className="text-sm text-gray-600">Automated insights and trend predictions</div>
                </div>
                <div className="text-sm text-orange-600 font-medium">Future</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Metrics Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              For now, basic statistics are available on the main dashboard. 
              Advanced analytics with charts and detailed breakdowns will be available soon.
            </p>
            <div className="flex gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">--</div>
                <div className="text-sm text-gray-600">Conversion Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">--</div>
                <div className="text-sm text-gray-600">Avg. Response Time</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">--</div>
                <div className="text-sm text-gray-600">Popular Pages</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedLayout>
  );
}