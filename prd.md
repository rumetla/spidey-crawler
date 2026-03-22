# Product PRD

## Project Title

Spidey Crawler: Human-Facing Product and Build Plan

## Summary

This document outlines the architecture, product requirements, and build plan for a highly concurrent web crawler and real-time search engine. [cite_start]The goal is to deliver a localhost-runnable application that demonstrates strong system design, concurrency management, and "Human-in-the-Loop" visibility[cite: 31]. 

[cite_start]The system must crawl an origin URL to a bounded depth `k` [cite: 35, 178][cite_start], enforce a strict visited set to avoid redundant crawls [cite: 37, 178][cite_start], manage its own back pressure [cite: 39, 181][cite_start], and expose a live search interface that reflects newly discovered results while the indexer is still running[cite: 47, 185].

## Product Objectives

- [cite_start]Crawl from an origin URL up to a maximum depth `k`[cite: 35, 178].
- [cite_start]Guarantee no page is crawled twice within a single job[cite: 37, 178].
- [cite_start]Implement and visualize back pressure (e.g., maximum queue depth, thread throttling)[cite: 39, 181].
- [cite_start]Serve live search results concurrently with the indexing process[cite: 47, 185].
- [cite_start]Return search triples in the format: `(relevant_url, origin_url, depth)`[cite: 45, 183].
- [cite_start]Provide a clear, dark-themed operator dashboard to monitor system state in real-time[cite: 63, 65, 189].
- [cite_start]Persist state locally to allow the system to resume interrupted crawls without starting from scratch[cite: 71, 190].

## Intended Reviewer Experience

1. Start the monorepo locally with a single command.
2. Open the Next.js UI and launch a crawl job via the control form.
3. Observe live Server-Sent Events (SSE) streaming queue depth, processed URLs, and active worker counts.
4. Execute search queries while the crawler is visually still running.
5. Review the custom status page to inspect execution logs and thread health.
6. Stop the Nest.js backend mid-crawl, restart it, and watch the system recover and resume from SQLite.

## Scope & Constraints

### In Scope
- [cite_start]Single-machine, multi-threaded crawler[cite: 180].
- Next.js frontend, Nest.js backend, and SQLite database.
- [cite_start]Breadth-First Search (BFS) traversal mapped to depth `k`[cite: 178, 179].
- [cite_start]Strict use of language-native functionality (native `fetch`, standard library text parsing)[cite: 41, 177].
- [cite_start]Search ranking based on keyword frequency and title matching heuristics[cite: 51].

### Out of Scope
- [cite_start]Fully-featured parsing libraries like BeautifulSoup, Scrapy, or Cheerio[cite: 41].
- [cite_start]Multi-node deployment[cite: 180].
- Headless browser rendering (e.g., Puppeteer) for JavaScript-heavy DOMs.
- Advanced NLP or PageRank algorithms.

## Chosen Stack

[cite_start]The project utilizes a monorepo setup optimized for speed and explainability within the 3-5 hour timeframe[cite: 192].

- **Frontend:** `Next.js` (App Router, React, Tailwind CSS)
- **Backend:** `Nest.js` (Node.js, TypeScript)
- **Database:** `SQLite` (Configured in WAL mode for concurrent operations)
- **Concurrency:** Node.js native `worker_threads`
- **Real-time updates:** Server-Sent Events (SSE)

## Core Product Surfaces

### 1. The Operator Dashboard
A high-contrast, terminal-inspired interface. It avoids generic UI tropes in favor of strict data density.
- [cite_start]Top-line metrics: Indexed pages, Queue Depth, Active Threads, Throttling Status[cite: 66, 67, 68, 69, 189].
- Live system activity feed.
- Embedded search panel.

### 2. Launch Console
The control surface for initiating crawler jobs.
- [cite_start]Inputs: Origin URL, Max Depth (k)[cite: 178, 179], Max Workers, Queue Ceiling.

### 3. Job Status View
A dedicated page for observing an active or completed crawl.
- [cite_start]Displays back pressure events[cite: 189].
- Real-time logging of URLs passing through the `worker_threads`.

### 4. Live Search
A query interface that interacts with the hot SQLite index.
- [cite_start]Displays search results with origin URL, depth, and a relevancy score[cite: 45, 183].

## Build Plan

### Phase 1: Foundation & DB Schema
- Scaffold the Next.js and Nest.js monorepo.
- [cite_start]Initialize SQLite and configure Write-Ahead Logging (WAL) to ensure the crawler can write while the search API reads[cite: 47, 185].
- Define schemas for Jobs, URLs (Visited Set), and Inverted Terms.

### Phase 2: Concurrent Crawler Primitives
- Implement the BFS queue. 
- Build the `worker_threads` pool. 
- [cite_start]Implement the "Visited" set constraint: URLs are marked visited upon entering the queue, not post-fetch, preventing multi-thread race conditions[cite: 37, 178].
- [cite_start]Enforce back pressure: Workers suspend activity if the database queue exceeds the configured threshold[cite: 39].

### Phase 3: Native Extraction & Indexing
- [cite_start]Use native `fetch` to retrieve HTML[cite: 41, 177].
- [cite_start]Use Regex/string methods to parse `<title>`, strip HTML tags from the `<body>`, and extract `href` attributes[cite: 41, 177].
- Sync tokenized data to SQLite.

### Phase 4: Search Engine API
- Expose a `GET /search` endpoint.
- [cite_start]Implement ranking: `(Title token frequency * 5) + (Body token frequency * 1) - (Depth * 0.5)`[cite: 51].

### Phase 5: Resumability (Bonus)
- Track frontier states (Pending, Processing, Completed) in SQLite.
- [cite_start]On backend initialization, revert any "Processing" URLs to "Pending" to resume the crawl safely[cite: 71, 190].

### Phase 6: Frontend Wiring
- Build the Tailwind UI.
- [cite_start]Connect the SSE streams to visualize the backend concurrency and queue depths[cite: 65, 189].

## Success Criteria
[cite_start]The project is a success if it accurately crawls to depth `k` without duplication [cite: 178][cite_start], visibly throttles workers under load [cite: 39][cite_start], returns live search results during an active crawl [cite: 47, 185][cite_start], cleanly recovers from interruptions[cite: 190], and runs flawlessly on a local WSL environment.