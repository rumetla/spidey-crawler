PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  origin_url TEXT NOT NULL,
  max_depth INTEGER NOT NULL,
  max_workers INTEGER NOT NULL DEFAULT 4,
  max_queue_size INTEGER NOT NULL DEFAULT 1000,
  same_domain INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK(status IN ('running', 'paused', 'completed', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS urls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  origin_url TEXT NOT NULL,
  depth INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
  title TEXT,
  body_text TEXT,
  discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT,
  FOREIGN KEY (job_id) REFERENCES jobs(id),
  UNIQUE(job_id, url)
);

-- Inverted index for full-text search ranking
CREATE TABLE IF NOT EXISTS terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url_id INTEGER NOT NULL,
  term TEXT NOT NULL,
  title_count INTEGER NOT NULL DEFAULT 0,
  body_count INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (url_id) REFERENCES urls(id)
);

CREATE INDEX IF NOT EXISTS idx_urls_job_status ON urls(job_id, status);
CREATE INDEX IF NOT EXISTS idx_urls_job_url ON urls(job_id, url);
CREATE INDEX IF NOT EXISTS idx_terms_term ON terms(term);
CREATE INDEX IF NOT EXISTS idx_terms_url_id ON terms(url_id);
