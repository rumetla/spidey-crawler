import type {
  CreateJobRequest,
  CreateJobResponse,
  SearchResponse,
  CrawlJob,
} from './types';

const API_BASE = '/api';

export async function createCrawlJob(
  req: CreateJobRequest,
): Promise<CreateJobResponse> {
  const res = await fetch(`${API_BASE}/crawl`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function getJob(jobId: number): Promise<CrawlJob> {
  const res = await fetch(`${API_BASE}/crawl/${jobId}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function cancelJob(jobId: number): Promise<void> {
  await fetch(`${API_BASE}/crawl/${jobId}`, { method: 'DELETE' });
}

export async function search(
  query: string,
  limit = 20,
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const res = await fetch(`${API_BASE}/search?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
