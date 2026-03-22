# Spidey Crawler

A highly concurrent web crawler and real-time search engine. Single-machine, multi-threaded BFS crawler with a live operator dashboard.

## Stack

- **Frontend:** Next.js (App Router, React, Tailwind CSS)
- **Backend:** Nest.js (Node.js, TypeScript)
- **Database:** SQLite (WAL mode for concurrent read/write)
- **Concurrency:** Node.js native `worker_threads`
- **Real-time:** Server-Sent Events (SSE)

## Quick Start

```bash
# Install dependencies
pnpm install

# Start both frontend and backend in dev mode
pnpm dev

# Or start individually
pnpm dev:api   # Nest.js on http://localhost:3001
pnpm dev:web   # Next.js on http://localhost:3000
```

## Architecture

```
apps/
├── api/    Nest.js backend (crawler engine, search API, SSE)
└── web/    Next.js frontend (operator dashboard)
```

## Key Constraints

- No external scraping libraries (Cheerio, Puppeteer, etc.)
- Native `fetch` + regex/string parsing only
- URLs marked visited on enqueue (not post-fetch) to prevent race conditions
- Back pressure: workers suspend when queue exceeds threshold
- Resumability: interrupted crawls resume from SQLite state
