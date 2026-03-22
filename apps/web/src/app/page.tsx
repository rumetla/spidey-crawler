'use client';

import { useState } from 'react';
import { useSSE } from '@/hooks/useSSE';
import { MetricsBar } from '@/components/dashboard/MetricsBar';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { LaunchConsole } from '@/components/launch/LaunchConsole';
import { SearchPanel } from '@/components/search/SearchPanel';

export default function DashboardPage() {
  const { metrics, recentUrls, logs, connected } = useSSE();
  const [activeJobId, setActiveJobId] = useState<number | null>(null);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Top-line Metrics */}
      <MetricsBar metrics={metrics} connected={connected} />

      {/* Two-column layout: Launch + Search */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LaunchConsole onJobStarted={(id) => setActiveJobId(id)} />
        <SearchPanel />
      </div>

      {/* Active Job Indicator */}
      {activeJobId !== null && (
        <div className="border border-accent/30 bg-accent/5 px-4 py-2 text-xs flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-accent">Job #{activeJobId} active</span>
        </div>
      )}

      {/* Live Activity Feeds */}
      <ActivityFeed recentUrls={recentUrls} logs={logs} />
    </div>
  );
}
