'use client';

import { useState, useEffect } from 'react';
import { useSSE } from '@/hooks/useSSE';
import { MetricsBar } from '@/components/dashboard/MetricsBar';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { LaunchConsole } from '@/components/launch/LaunchConsole';
import { SearchPanel } from '@/components/search/SearchPanel';

export default function DashboardPage() {
  const { metrics, recentUrls, logs, jobStatus, connected } = useSSE();
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [jobFinished, setJobFinished] = useState(false);

  useEffect(() => {
    if (jobStatus && activeJobId && jobStatus.jobId === activeJobId) {
      setJobFinished(true);
    }
  }, [jobStatus, activeJobId]);

  const handleJobStarted = (id: number) => {
    setActiveJobId(id);
    setJobFinished(false);
  };

  const handleJobCancelled = () => {
    setJobFinished(true);
  };

  const statusLabel = jobFinished
    ? jobStatus?.status === 'cancelled' ? 'CANCELLED' : 'COMPLETED'
    : 'RUNNING';

  const statusColor = jobFinished
    ? jobStatus?.status === 'cancelled' ? 'text-danger' : 'text-text-muted'
    : 'text-accent';

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <MetricsBar metrics={metrics} connected={connected} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LaunchConsole
          activeJobId={activeJobId}
          jobFinished={jobFinished}
          onJobStarted={handleJobStarted}
          onJobCancelled={handleJobCancelled}
        />
        <SearchPanel />
      </div>

      {activeJobId !== null && (
        <div className="border border-accent/30 bg-accent/5 px-4 py-2 text-xs flex items-center gap-2">
          {!jobFinished && (
            <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse" />
          )}
          <span className={statusColor}>
            Job #{activeJobId} — {statusLabel}
          </span>
        </div>
      )}

      <ActivityFeed recentUrls={recentUrls} logs={logs} />
    </div>
  );
}
