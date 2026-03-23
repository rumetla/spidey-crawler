# Product Requirements Document — Spidey Crawler

## Summary

Spidey Crawler is a highly concurrent web crawler and real-time search engine that runs entirely on a single machine. It crawls from an origin URL to a bounded depth `k`, enforces a strict visited set to avoid redundant work, manages back pressure under load, and exposes a live search interface that reflects newly discovered results while the indexer is still running.

## Product Objectives

- Crawl from an origin URL up to a maximum depth `k`.
- Guarantee no page is crawled twice within a single job.
- Implement and visualize back pressure (maximum queue depth, per-domain rate limiting, worker throttling).
- Serve live search results concurrently with the indexing process.
- Return search triples in the format: `(relevant_url, origin_url, depth)`.
- Provide a dark-themed operator dashboard to monitor system state in real-time.
- Persist state locally to allow the system to resume interrupted crawls without starting from scratch.

## Intended Reviewer Experience

1. Start the monorepo locally with `pnpm install && pnpm dev`.
2. Open the Next.js UI at `http://localhost:3000` and launch a crawl job.
3. Observe live SSE streaming: queue depth, processed URLs, active worker counts, and pages/sec.
4. Execute search queries while the crawler is visually still running.
5. Stop the backend mid-crawl, restart it, and watch the system recover and resume from SQLite.
6. Cancel a job via the UI and see the status update in real time.

## Scope & Constraints

### In Scope

- Single-machine, multi-threaded crawler using Node.js `worker_threads`.
- Next.js frontend, Nest.js backend, SQLite database.
- Breadth-First Search (BFS) traversal mapped to depth `k`.
- Strict use of language-native functionality: native `fetch`, standard library text parsing via regex.
- Search ranking based on keyword frequency and title matching heuristics.
- Per-domain rate limiting to avoid overwhelming target servers.
- Optional same-domain filtering to restrict crawls to a single host.

### Out of Scope

- Fully-featured parsing libraries (Cheerio, BeautifulSoup, Scrapy, Puppeteer).
- Multi-node deployment.
- Headless browser rendering for JavaScript-heavy pages.
- Advanced NLP or PageRank algorithms.

## Chosen Stack

- **Frontend:** Next.js (App Router, React 19, Tailwind CSS v4)
- **Backend:** Nest.js (Node.js, TypeScript)
- **Database:** SQLite (WAL mode for concurrent read/write)
- **Concurrency:** Node.js native `worker_threads`
- **Real-time updates:** Server-Sent Events (SSE)
- **Monorepo:** pnpm workspaces

## Core Product Surfaces

### 1. Operator Dashboard

A high-contrast, terminal-inspired interface with strict data density.

- Top-line metrics: Indexed pages, Queue Depth, Active Workers, Throttling Status, Pages/sec, SSE connection status.
- Live system activity feed (processed URLs + system logs).
- Embedded search panel.

### 2. Launch Console

The control surface for initiating and managing crawler jobs.

- Inputs: Origin URL, Max Depth (k), Max Workers, Queue Ceiling.
- Same-domain filter checkbox.
- Cancel button for active jobs with real-time status feedback.

### 3. Live Search

A query interface that reads from the hot SQLite index while crawling is active.

- Returns search results as `(relevant_url, origin_url, depth)` triples.
- Relevancy score displayed per result.
- Ranking formula: `(title_count * 5) + (body_count * 1) - (depth * 0.5)`.

## Architecture

```
Browser (localhost:3000)
  └── Next.js App Router
        └── EventSource → /api/crawl/events (SSE)
        └── fetch → /api/crawl (POST/GET/DELETE)
        └── fetch → /api/search?q=...

Next.js rewrites /api/* → Nest.js (localhost:3001)

Nest.js Backend
  ├── CrawlerController    → job CRUD + SSE stream
  ├── CrawlerService       → BFS loop, worker pool, rate limiting, back pressure
  │     └── worker_threads → native fetch + regex HTML parsing
  ├── SearchController     → search endpoint
  ├── SearchService        → inverted index queries
  ├── DatabaseService      → SQLite (WAL mode, schema init, resumability)
  └── SSEService           → RxJS Subject event bus

SQLite (apps/api/data/spidey.db)
  ├── jobs       → crawl job state and config
  ├── urls       → frontier (pending/processing/completed/failed), visited set via UNIQUE(job_id, url)
  └── terms      → inverted index (term → url_id, title_count, body_count)
```

## Key Design Decisions

### Visited Set: Mark on Enqueue

URLs are marked as visited the moment they enter the queue (`INSERT ... UNIQUE(job_id, url)`), not after they are fetched. This prevents race conditions where multiple workers discover the same link simultaneously.

### Back Pressure

The system applies back pressure at two levels:
1. **Queue depth ceiling:** When pending URLs exceed the configured maximum, new link discovery is suppressed (existing URLs continue processing).
2. **Per-domain rate limiting:** A minimum 200ms delay between requests to the same hostname prevents overwhelming target servers.

### Resumability

On startup, any URLs stuck in "processing" state are reset to "pending". Running jobs from a previous session are automatically detected and their crawl loops resumed.

### Search During Active Indexing

SQLite WAL mode allows concurrent reads (search) and writes (indexing). Search queries reflect the latest indexed state including pages discovered during the current crawl session.

## Build Phases

### Phase 1: Foundation & DB Schema
- Scaffold Next.js + Nest.js monorepo.
- Initialize SQLite with WAL mode.
- Define schemas for jobs, URLs (visited set), and inverted terms.

### Phase 2: Concurrent Crawler
- Implement BFS queue with depth tracking.
- Build `worker_threads` pool with configurable concurrency.
- Implement visited-on-enqueue constraint.
- Enforce back pressure via queue ceiling and per-domain rate limiting.

### Phase 3: Native Extraction & Indexing
- Use native `fetch` to retrieve HTML.
- Use regex/string methods to parse `<title>`, strip tags from `<body>`, extract `href` attributes.
- Tokenize and store term frequencies in SQLite inverted index.

### Phase 4: Search Engine API
- Expose `GET /api/search?q=...` endpoint.
- Implement ranking: `(title * 5) + (body * 1) - (depth * 0.5)`.

### Phase 5: Resumability
- Track frontier states (Pending, Processing, Completed, Failed) in SQLite.
- On startup, revert "Processing" → "Pending" and resume running jobs.

### Phase 6: Frontend
- Build Tailwind-powered dark operator dashboard.
- Connect SSE streams for live metrics, URL feed, and system logs.
- Wire launch console with cancel capability.

## Success Criteria

- Crawls to depth `k` without visiting any page twice.
- Visibly throttles workers under load (back pressure metrics displayed in UI).
- Returns live search results during an active crawl.
- Cleanly recovers from interruptions and resumes without data loss.
- Runs locally with a single `pnpm dev` command.
