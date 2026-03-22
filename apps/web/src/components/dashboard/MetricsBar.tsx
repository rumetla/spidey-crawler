'use client';

import type { MetricsEvent } from '@/lib/types';

interface MetricsBarProps {
  metrics: MetricsEvent;
  connected: boolean;
}

function MetricCell({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="border border-border px-4 py-3 min-w-[140px]">
      <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">
        {label}
      </div>
      <div className={`text-2xl font-bold tabular-nums ${accent ? 'text-accent' : 'text-text-primary'}`}>
        {value}
      </div>
    </div>
  );
}

export function MetricsBar({ metrics, connected }: MetricsBarProps) {
  return (
    <div className="flex flex-wrap gap-px bg-border">
      <MetricCell
        label="Indexed"
        value={metrics.indexedPages}
        accent
      />
      <MetricCell
        label="Queue Depth"
        value={metrics.queueDepth}
      />
      <MetricCell
        label="Workers"
        value={metrics.activeWorkers}
      />
      <MetricCell
        label="Throttled"
        value={metrics.isThrottled ? 'YES' : 'NO'}
        accent={metrics.isThrottled}
      />
      <MetricCell
        label="Pages/sec"
        value={metrics.pagesPerSecond.toFixed(1)}
      />
      <div className="border border-border px-4 py-3 min-w-[140px]">
        <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">
          SSE Link
        </div>
        <div className={`text-2xl font-bold ${connected ? 'text-accent' : 'text-danger'}`}>
          {connected ? 'LIVE' : 'DOWN'}
        </div>
      </div>
    </div>
  );
}
