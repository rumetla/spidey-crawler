// ── Enums ──

export enum UrlStatus {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
}

export enum JobStatus {
  Running = 'running',
  Paused = 'paused',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

// ── Database Row Types ──

export interface JobRow {
  id: number;
  origin_url: string;
  max_depth: number;
  max_workers: number;
  max_queue_size: number;
  status: JobStatus;
  created_at: string;
  updated_at: string;
}

export interface UrlRow {
  id: number;
  job_id: number;
  url: string;
  origin_url: string;
  depth: number;
  status: UrlStatus;
  title: string | null;
  body_text: string | null;
  discovered_at: string;
  processed_at: string | null;
}

export interface TermRow {
  id: number;
  url_id: number;
  term: string;
  title_count: number;
  body_count: number;
}

// ── API DTOs ──

export interface CreateJobDto {
  originUrl: string;
  maxDepth: number;
  maxWorkers?: number;
  maxQueueSize?: number;
}

export interface SearchResultDto {
  relevantUrl: string;
  originUrl: string;
  depth: number;
  score: number;
  title: string;
}

// ── Crawler Internal Types ──

export interface WorkerTask {
  url: string;
  jobId: number;
  depth: number;
  originUrl: string;
}

export interface WorkerResult {
  type: 'result';
  url: string;
  title: string;
  bodyText: string;
  links: string[];
}

export interface WorkerError {
  type: 'error';
  url: string;
  error: string;
}

export type WorkerMessage = WorkerResult | WorkerError;

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

export type SSEEventType = 'metrics' | 'url_processed' | 'backpressure' | 'job_status' | 'log';

export interface SSEEvent {
  type: SSEEventType;
  data: MetricsEvent | UrlProcessedEvent | BackPressureEvent | LogEvent | Record<string, unknown>;
  timestamp: number;
}
