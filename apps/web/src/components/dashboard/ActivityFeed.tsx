'use client';

import type { UrlProcessedEvent, LogEvent } from '@/lib/types';

interface ActivityFeedProps {
  recentUrls: UrlProcessedEvent[];
  logs: LogEvent[];
}

const LOG_LEVEL_COLORS: Record<string, string> = {
  info: 'text-accent',
  warn: 'text-warn',
  error: 'text-danger',
};

export function ActivityFeed({ recentUrls, logs }: ActivityFeedProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* URL Processing Feed */}
      <div className="border border-border">
        <div className="border-b border-border px-4 py-2 bg-surface-raised">
          <span className="text-[10px] uppercase tracking-widest text-text-muted">
            Processed URLs
          </span>
        </div>
        <div className="h-[300px] overflow-y-auto p-2 space-y-1 font-mono text-xs">
          {recentUrls.length === 0 ? (
            <div className="text-text-muted p-2">Waiting for crawl data...</div>
          ) : (
            recentUrls.map((entry, i) => (
              <div key={`${entry.url}-${i}`} className="flex gap-2 py-0.5 border-b border-border/50">
                <span className="text-accent-dim shrink-0">d{entry.depth}</span>
                <span className="text-text-muted shrink-0">+{entry.linksFound}</span>
                <span className="text-text-primary truncate" title={entry.url}>
                  {entry.url}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* System Log Feed */}
      <div className="border border-border">
        <div className="border-b border-border px-4 py-2 bg-surface-raised">
          <span className="text-[10px] uppercase tracking-widest text-text-muted">
            System Log
          </span>
        </div>
        <div className="h-[300px] overflow-y-auto p-2 space-y-1 font-mono text-xs">
          {logs.length === 0 ? (
            <div className="text-text-muted p-2">No log entries yet...</div>
          ) : (
            logs.map((entry, i) => (
              <div key={`${entry.timestamp}-${i}`} className="flex gap-2 py-0.5">
                <span className={`shrink-0 uppercase text-[10px] ${LOG_LEVEL_COLORS[entry.level] ?? 'text-text-muted'}`}>
                  [{entry.level}]
                </span>
                <span className="text-text-primary">{entry.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
