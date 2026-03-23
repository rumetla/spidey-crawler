# Spidey Crawler

A concurrent web crawler and real-time search engine built with Node.js. Crawls from an origin URL to a configurable depth, indexes page content into an inverted index, and serves live search results — all on a single machine using native concurrency primitives.

## What This Demonstrates

- **BFS web crawling** with configurable depth `k` and strict deduplication
- **Concurrent worker_threads** pool with back pressure and per-domain rate limiting
- **Live search** that returns results while indexing is still active
- **Resumability** — interrupted crawls resume from SQLite state on restart
- **Real-time dashboard** via Server-Sent Events (SSE)
- **Language-native approach** — no scraping libraries; uses native `fetch` and regex parsing

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS v4 |
| Backend | Nest.js 11, TypeScript |
| Database | SQLite (WAL mode) via better-sqlite3 |
| Concurrency | Node.js `worker_threads` |
| Real-time | Server-Sent Events (SSE) |
| Monorepo | pnpm workspaces |

## Prerequisites

- **Node.js** >= 20 (LTS recommended)
- **pnpm** >= 9
- **Build tools** for native addons: `python3`, `make`, `g++`

On Debian/Ubuntu/Mint:
```bash
sudo apt install -y python3 make g++
```

## Quick Start

```bash
# Clone and install
git clone <repo-url> && cd spidey-crawler
pnpm install

# If better-sqlite3 fails to find bindings, rebuild it:
pnpm rebuild better-sqlite3

# Start both servers in dev mode
pnpm dev
```

- **Dashboard:** http://localhost:3000
- **API:** http://localhost:3001

## How to Use

1. Open http://localhost:3000 in your browser.
2. Enter a URL (e.g., `https://example.com`) and configure depth, workers, and queue ceiling.
3. Optionally check "Same domain only" to restrict crawling to the origin hostname.
4. Click **Start Crawl** and watch the metrics update in real time.
5. Use the **Live Search** panel to query indexed pages while crawling is active.
6. Click **Cancel Crawl** to stop a running job.

## Architecture

```
apps/
├── api/                 Nest.js Backend (port 3001)
│   └── src/
│       ├── main.ts                    Entry point
│       ├── app.module.ts              Root module
│       ├── common/interfaces.ts       Shared TypeScript types
│       ├── database/
│       │   ├── database.service.ts    SQLite lifecycle, CRUD, search queries
│       │   └── schema.sql             Tables: jobs, urls, terms
│       ├── crawler/
│       │   ├── crawler.service.ts     BFS loop, worker pool, rate limiting
│       │   ├── crawler.controller.ts  REST + SSE endpoints
│       │   └── worker/
│       │       ├── crawler.worker.ts  Worker thread (native fetch)
│       │       └── html-parser.ts     Regex parser + tokenizer
│       ├── search/
│       │   ├── search.service.ts      Inverted index queries
│       │   └── search.controller.ts   GET /api/search?q=...
│       └── sse/
│           └── sse.service.ts         RxJS Subject event bus
│
└── web/                 Next.js Frontend (port 3000)
    └── src/
        ├── app/
        │   ├── layout.tsx             Dark console shell
        │   ├── page.tsx               Dashboard (assembles all panels)
        │   └── globals.css            Tailwind v4 theme
        ├── components/
        │   ├── dashboard/
        │   │   ├── MetricsBar.tsx     Top-line metrics
        │   │   └── ActivityFeed.tsx   URL feed + system log
        │   ├── launch/
        │   │   └── LaunchConsole.tsx  Job launch + cancel
        │   └── search/
        │       ├── SearchPanel.tsx    Search input
        │       └── SearchResult.tsx   Result display
        ├── hooks/useSSE.ts            EventSource hook
        └── lib/
            ├── types.ts               Frontend type mirrors
            └── api.ts                 Typed fetch client
```

## How the Crawler Works

### BFS with Depth Tracking

The crawler performs breadth-first traversal starting from the origin URL at depth 0. Each discovered link is enqueued at `parent_depth + 1`. Links beyond `max_depth` are not enqueued. The BFS ordering is enforced by the database query: `ORDER BY depth ASC, id ASC`.

### Visited Set (Deduplication)

URLs are marked as visited **on enqueue**, not after fetching. This uses a `UNIQUE(job_id, url)` constraint — if a worker discovers a link that's already in the database, the INSERT fails silently and the link is skipped. This prevents race conditions where multiple workers discover the same link simultaneously.

### Worker Threads

Each URL is fetched by a dedicated `worker_thread`. The main thread manages a pool of up to `max_workers` concurrent workers. Workers use Node's native `fetch` API with a 10-second abort timeout, parse HTML with regex (no DOM libraries), and post results back to the main thread.

### Back Pressure

Two mechanisms prevent the crawler from overwhelming the system or target servers:

1. **Queue ceiling:** When pending URLs exceed `max_queue_size`, new link discovery is paused (workers keep draining the existing queue).
2. **Per-domain rate limiting:** A minimum 200ms gap is enforced between requests to the same hostname, preventing 429 responses from polite servers.

### Same-Domain Filter

When enabled, the crawler only enqueues links whose hostname matches the origin URL. This keeps crawls focused on a single site rather than following cross-domain links.

## How Search Works

### Inverted Index

When a page is crawled, its title and body text are tokenized into individual terms. For each term, we store `(url_id, title_count, body_count)` — how many times the term appears in the title versus the body.

### Ranking Formula

```
score = SUM(title_count * 5 + body_count) - (depth * 0.5)
```

- Title matches are weighted 5x because titles are more semantically meaningful.
- Deeper pages are penalized slightly (they're further from the origin and generally less relevant).

### Live Results

SQLite's WAL (Write-Ahead Logging) mode allows the search endpoint to read from the index concurrently while the crawler is writing new entries. Search results reflect the latest state of the crawl in real time.

## Resumability

If the server is stopped mid-crawl and restarted:

1. URLs stuck in "processing" state are reset to "pending" (they were claimed but never completed).
2. Jobs still marked "running" with pending URLs have their crawl loops automatically resumed.
3. The visited set (all URLs already in the database) is preserved, so no page is re-crawled.

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/crawl` | Start a new crawl job |
| GET | `/api/crawl/events` | SSE stream for real-time events |
| GET | `/api/crawl/:id` | Get job status |
| DELETE | `/api/crawl/:id` | Cancel a running job |
| GET | `/api/search?q=...&limit=20` | Search indexed pages |

### POST /api/crawl

```json
{
  "originUrl": "https://example.com",
  "maxDepth": 2,
  "maxWorkers": 4,
  "maxQueueSize": 1000,
  "sameDomain": false
}
```

### GET /api/search?q=wikipedia

```json
{
  "query": "wikipedia",
  "count": 3,
  "results": [
    {
      "relevantUrl": "https://en.wikipedia.org/",
      "originUrl": "https://www.wikipedia.com",
      "depth": 1,
      "score": 42.5,
      "title": "Wikipedia, the free encyclopedia"
    }
  ]
}
```

## Design Trade-offs

- **Regex HTML parsing** over DOM libraries: Faster and zero dependencies, but fragile on malformed HTML. Acceptable for this use case since we only need titles, body text, and hrefs.
- **SQLite over PostgreSQL**: Zero setup, portable, WAL enables concurrent read/write. Trades write throughput at extreme scale for simplicity.
- **One worker per URL** over batch processing: Simpler failure isolation (a crashed worker only loses one URL) at the cost of thread creation overhead. Acceptable because `worker_threads` reuse the V8 isolate.
- **Per-domain rate limit as a fixed delay** over adaptive rate limiting: Simple to reason about. A production system would inspect `Retry-After` headers and adapt per-domain.
