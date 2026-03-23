'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type {
  SSEEvent,
  MetricsEvent,
  UrlProcessedEvent,
  LogEvent,
  JobStatusEvent,
} from '@/lib/types';

const MAX_LOG_ENTRIES = 200;

export interface CrawlerState {
  metrics: MetricsEvent;
  recentUrls: UrlProcessedEvent[];
  logs: LogEvent[];
  jobStatus: JobStatusEvent | null;
  connected: boolean;
}

const DEFAULT_METRICS: MetricsEvent = {
  indexedPages: 0,
  queueDepth: 0,
  activeWorkers: 0,
  isThrottled: false,
  pagesPerSecond: 0,
};

export function useSSE(): CrawlerState {
  const [metrics, setMetrics] = useState<MetricsEvent>(DEFAULT_METRICS);
  const [recentUrls, setRecentUrls] = useState<UrlProcessedEvent[]>([]);
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [jobStatus, setJobStatus] = useState<JobStatusEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const handleEvent = useCallback((raw: string) => {
    try {
      const event: SSEEvent = JSON.parse(raw);

      switch (event.type) {
        case 'metrics':
          setMetrics(event.data as MetricsEvent);
          break;
        case 'url_processed':
          setRecentUrls((prev) =>
            [event.data as UrlProcessedEvent, ...prev].slice(0, MAX_LOG_ENTRIES),
          );
          break;
        case 'log':
          setLogs((prev) =>
            [event.data as LogEvent, ...prev].slice(0, MAX_LOG_ENTRIES),
          );
          break;
        case 'job_status':
          setJobStatus(event.data as JobStatusEvent);
          break;
        case 'backpressure':
          setLogs((prev) =>
            [
              { level: 'warn' as const, message: `Back pressure active — queue depth ${(event.data as Record<string, unknown>).queueDepth}`, timestamp: event.timestamp },
              ...prev,
            ].slice(0, MAX_LOG_ENTRIES),
          );
          break;
      }
    } catch {
      // Malformed SSE data — ignore
    }
  }, []);

  useEffect(() => {
    const es = new EventSource('/api/crawl/events');
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.addEventListener('metrics', (e) => handleEvent(e.data));
    es.addEventListener('url_processed', (e) => handleEvent(e.data));
    es.addEventListener('log', (e) => handleEvent(e.data));
    es.addEventListener('backpressure', (e) => handleEvent(e.data));
    es.addEventListener('job_status', (e) => handleEvent(e.data));

    es.onmessage = (e) => handleEvent(e.data);

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [handleEvent]);

  return { metrics, recentUrls, logs, jobStatus, connected };
}
