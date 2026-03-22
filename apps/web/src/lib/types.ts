// ── API Response Types (mirrors backend interfaces) ──

export interface CrawlJob {
  id: number;
  origin_url: string;
  max_depth: number;
  max_workers: number;
  max_queue_size: number;
  status: 'running' | 'paused' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface SearchResult {
  relevantUrl: string;
  originUrl: string;
  depth: number;
  score: number;
  title: string;
}

export interface SearchResponse {
  query: string;
  count: number;
  results: SearchResult[];
}

export interface CreateJobRequest {
  originUrl: string;
  maxDepth: number;
  maxWorkers?: number;
  maxQueueSize?: number;
}

export interface CreateJobResponse {
  jobId: number;
  status: string;
}

// ── SSE Event Types ──

export interface MetricsEvent {
  indexedPages: number;
  queueDepth: number;
  activeWorkers: number;
  isThrottled: boolean;
  pagesPerSecond: number;
}

export interface UrlProcessedEvent {
  url: string;
  depth: number;
  linksFound: number;
  title: string;
}

export interface BackPressureEvent {
  isThrottled: boolean;
  queueDepth: number;
  maxQueueSize: number;
  activeWorkers: number;
  maxWorkers: number;
}

export interface LogEvent {
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
}

export interface SSEEvent {
  type: 'metrics' | 'url_processed' | 'backpressure' | 'job_status' | 'log';
  data: MetricsEvent | UrlProcessedEvent | BackPressureEvent | LogEvent | Record<string, unknown>;
  timestamp: number;
}
