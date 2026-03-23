import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import {
  JobRow,
  UrlRow,
  TermRow,
  UrlStatus,
  JobStatus,
} from '../common/interfaces';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private db!: Database.Database;
  private readonly logger = new Logger(DatabaseService.name);
  private readonly dbPath = path.resolve(process.cwd(), 'data', 'spidey.db');

  onModuleInit(): void {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.logger.log(`SQLite opened at ${this.dbPath}`);

    const schema = fs.readFileSync(
      path.resolve(__dirname, 'schema.sql'),
      'utf-8',
    );
    this.db.exec(schema);
    this.logger.log('Schema initialized (WAL mode enabled)');

    this.recoverInterruptedJobs();
  }

  onModuleDestroy(): void {
    this.db.close();
    this.logger.log('SQLite connection closed');
  }

  /** Reset any URLs stuck in "processing" back to "pending" for resumability */
  private recoverInterruptedJobs(): void {
    const result = this.db
      .prepare(`UPDATE urls SET status = ? WHERE status = ?`)
      .run(UrlStatus.Pending, UrlStatus.Processing);

    if (result.changes > 0) {
      this.logger.warn(
        `Recovered ${result.changes} interrupted URLs back to pending`,
      );
    }

    const runningJobs = this.db
      .prepare(`SELECT id FROM jobs WHERE status = ?`)
      .all(JobStatus.Running) as Pick<JobRow, 'id'>[];

    if (runningJobs.length > 0) {
      this.logger.warn(
        `Found ${runningJobs.length} running jobs from previous session`,
      );
    }
  }

  // ── Job Operations ──

  createJob(
    originUrl: string,
    maxDepth: number,
    maxWorkers: number,
    maxQueueSize: number,
    sameDomain: boolean,
  ): JobRow {
    const stmt = this.db.prepare(`
      INSERT INTO jobs (origin_url, max_depth, max_workers, max_queue_size, same_domain)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(originUrl, maxDepth, maxWorkers, maxQueueSize, sameDomain ? 1 : 0);
    return this.getJob(info.lastInsertRowid as number)!;
  }

  getJob(id: number): JobRow | undefined {
    return this.db
      .prepare(`SELECT * FROM jobs WHERE id = ?`)
      .get(id) as JobRow | undefined;
  }

  getRunningJobs(): JobRow[] {
    return this.db
      .prepare(`SELECT * FROM jobs WHERE status = ?`)
      .all(JobStatus.Running) as JobRow[];
  }

  updateJobStatus(id: number, status: JobStatus): void {
    this.db
      .prepare(`UPDATE jobs SET status = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(status, id);
  }

  // ── URL / Frontier Operations ──

  /**
   * Enqueue a URL — marks it as visited immediately on insert.
   * Returns true if inserted (new URL), false if already exists (duplicate).
   */
  enqueueUrl(
    jobId: number,
    url: string,
    originUrl: string,
    depth: number,
  ): boolean {
    try {
      this.db
        .prepare(`
          INSERT INTO urls (job_id, url, origin_url, depth, status)
          VALUES (?, ?, ?, ?, ?)
        `)
        .run(jobId, url, originUrl, depth, UrlStatus.Pending);
      return true;
    } catch {
      // UNIQUE constraint violation → already visited
      return false;
    }
  }

  /** Atomically claim the next batch of pending URLs for processing */
  claimPendingUrls(jobId: number, limit: number): UrlRow[] {
    const claim = this.db.transaction(() => {
      const rows = this.db
        .prepare(`
          SELECT * FROM urls
          WHERE job_id = ? AND status = ?
          ORDER BY depth ASC, id ASC
          LIMIT ?
        `)
        .all(jobId, UrlStatus.Pending, limit) as UrlRow[];

      if (rows.length > 0) {
        const ids = rows.map((r) => r.id);
        this.db
          .prepare(
            `UPDATE urls SET status = ? WHERE id IN (${ids.map(() => '?').join(',')})`,
          )
          .run(UrlStatus.Processing, ...ids);
      }

      return rows;
    });

    return claim();
  }

  markUrlCompleted(
    urlId: number,
    title: string,
    bodyText: string,
  ): void {
    this.db
      .prepare(`
        UPDATE urls
        SET status = ?, title = ?, body_text = ?, processed_at = datetime('now')
        WHERE id = ?
      `)
      .run(UrlStatus.Completed, title, bodyText, urlId);
  }

  markUrlFailed(urlId: number): void {
    this.db
      .prepare(`UPDATE urls SET status = ?, processed_at = datetime('now') WHERE id = ?`)
      .run(UrlStatus.Failed, urlId);
  }

  unclaimUrl(urlId: number): void {
    this.db
      .prepare(`UPDATE urls SET status = ? WHERE id = ? AND status = ?`)
      .run(UrlStatus.Pending, urlId, UrlStatus.Processing);
  }

  // ── Metrics Queries ──

  getQueueDepth(jobId: number): number {
    const row = this.db
      .prepare(`SELECT COUNT(*) as count FROM urls WHERE job_id = ? AND status = ?`)
      .get(jobId, UrlStatus.Pending) as { count: number };
    return row.count;
  }

  getIndexedCount(jobId: number): number {
    const row = this.db
      .prepare(`SELECT COUNT(*) as count FROM urls WHERE job_id = ? AND status = ?`)
      .get(jobId, UrlStatus.Completed) as { count: number };
    return row.count;
  }

  getTotalUrlCount(jobId: number): number {
    const row = this.db
      .prepare(`SELECT COUNT(*) as count FROM urls WHERE job_id = ?`)
      .get(jobId) as { count: number };
    return row.count;
  }

  // ── Indexing (Inverted Index) ──

  indexTerms(urlId: number, terms: Map<string, { title: number; body: number }>): void {
    const insert = this.db.prepare(`
      INSERT INTO terms (url_id, term, title_count, body_count)
      VALUES (?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction(
      (entries: [string, { title: number; body: number }][]) => {
        for (const [term, counts] of entries) {
          insert.run(urlId, term, counts.title, counts.body);
        }
      },
    );

    insertMany([...terms.entries()]);
  }

  // ── Search ──

  /**
   * Ranking: (title_count * 5) + (body_count * 1) - (depth * 0.5)
   * Returns results for all jobs that match the query terms.
   */
  search(
    query: string,
    limit = 20,
  ): Array<{ relevant_url: string; origin_url: string; depth: number; score: number; title: string }> {
    const tokens = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 1);

    if (tokens.length === 0) return [];

    const placeholders = tokens.map(() => '?').join(',');

    const rows = this.db
      .prepare(`
        SELECT
          u.url AS relevant_url,
          u.origin_url,
          u.depth,
          u.title,
          SUM(t.title_count * 5 + t.body_count) - (u.depth * 0.5) AS score
        FROM terms t
        JOIN urls u ON u.id = t.url_id
        WHERE t.term IN (${placeholders})
          AND u.status = 'completed'
        GROUP BY t.url_id
        ORDER BY score DESC
        LIMIT ?
      `)
      .all(...tokens, limit) as Array<{
      relevant_url: string;
      origin_url: string;
      depth: number;
      title: string;
      score: number;
    }>;

    return rows;
  }

  /**
   * Assignment scoring: (frequency * 10) + 1000 (exact match bonus) - (depth * 5)
   * frequency = title_count + body_count per matched term.
   */
  searchByRelevance(
    query: string,
    limit = 20,
  ): Array<{
    url: string;
    origin_url: string;
    depth: number;
    frequency: number;
    relevance_score: number;
    title: string;
  }> {
    const tokens = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 1);

    if (tokens.length === 0) return [];

    const placeholders = tokens.map(() => '?').join(',');

    return this.db
      .prepare(
        `
        SELECT
          u.url,
          u.origin_url,
          u.depth,
          u.title,
          SUM(t.title_count + t.body_count) AS frequency,
          SUM((t.title_count + t.body_count) * 10 + 1000) - (u.depth * 5) AS relevance_score
        FROM terms t
        JOIN urls u ON u.id = t.url_id
        WHERE t.term IN (${placeholders})
          AND u.status = 'completed'
        GROUP BY t.url_id
        ORDER BY relevance_score DESC
        LIMIT ?
      `,
      )
      .all(...tokens, limit) as Array<{
      url: string;
      origin_url: string;
      depth: number;
      frequency: number;
      relevance_score: number;
      title: string;
    }>;
  }

  /**
   * Export the full inverted index as flat text for data/storage/p.data.
   * Each line: word url origin depth frequency
   */
  exportTermsFlat(): Array<{
    term: string;
    url: string;
    origin_url: string;
    depth: number;
    frequency: number;
  }> {
    return this.db
      .prepare(
        `
        SELECT
          t.term,
          u.url,
          u.origin_url,
          u.depth,
          (t.title_count + t.body_count) AS frequency
        FROM terms t
        JOIN urls u ON u.id = t.url_id
        WHERE u.status = 'completed'
        ORDER BY t.term, u.url
      `,
      )
      .all() as Array<{
      term: string;
      url: string;
      origin_url: string;
      depth: number;
      frequency: number;
    }>;
  }

  getRawDb(): Database.Database {
    return this.db;
  }
}
