import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Worker } from 'worker_threads';
import * as path from 'path';
import * as fs from 'fs';
import { DatabaseService } from '../database/database.service';
import { SSEService } from '../sse/sse.service';
import {
  JobRow,
  UrlRow,
  JobStatus,
  WorkerTask,
  WorkerMessage,
  MetricsEvent,
} from '../common/interfaces';
import { buildTermFrequencies } from './worker/html-parser';

const RATE_LIMIT_MS = 200;
const METRICS_INTERVAL_MS = 500;
const WORKER_TIMEOUT_MS = 15_000;
const ROLLING_WINDOW_MS = 30_000;

@Injectable()
export class CrawlerService implements OnModuleInit {
  private readonly logger = new Logger(CrawlerService.name);
  private activeJobs = new Map<number, { interval: NodeJS.Timeout }>();
  private completionTimestamps: number[] = [];
  private domainLastHit = new Map<string, number>();
  private effectiveDomain = new Map<number, string>();

  constructor(
    private readonly db: DatabaseService,
    private readonly sse: SSEService,
  ) {}

  onModuleInit(): void {
    setTimeout(() => this.resumeRunningJobs(), 1000);
  }

  private resumeRunningJobs(): void {
    const runningJobs = this.db.getRunningJobs();
    for (const job of runningJobs) {
      const pending = this.db.getQueueDepth(job.id);
      if (pending > 0) {
        this.logger.log(
          `Resuming job #${job.id} (${job.origin_url}) — ${pending} URLs pending`,
        );
        this.sse.log('info', `Resuming crawl job #${job.id}: ${job.origin_url}`);
        this.runCrawlLoop(job);
      } else {
        this.db.updateJobStatus(job.id, JobStatus.Completed);
        this.logger.log(`Job #${job.id} had no pending URLs — marked completed`);
      }
    }
  }

  startJob(
    originUrl: string,
    maxDepth: number,
    maxWorkers = 4,
    maxQueueSize = 1000,
    sameDomain = false,
  ): JobRow {
    const job = this.db.createJob(originUrl, maxDepth, maxWorkers, maxQueueSize, sameDomain);
    this.logger.log(`Job ${job.id} created: ${originUrl} (depth=${maxDepth}, sameDomain=${sameDomain})`);

    this.db.enqueueUrl(job.id, originUrl, originUrl, 0);

    this.sse.log('info', `Crawl job #${job.id} started: ${originUrl}`);
    this.runCrawlLoop(job);

    return job;
  }

  private runCrawlLoop(job: JobRow): void {
    let activeWorkerCount = 0;
    let isThrottled = false;

    const metricsInterval = setInterval(() => {
      this.emitMetrics(job.id, activeWorkerCount, isThrottled);
    }, METRICS_INTERVAL_MS);

    this.activeJobs.set(job.id, { interval: metricsInterval });

    const processNext = (): void => {
      try {
        const currentJob = this.db.getJob(job.id);
        if (!currentJob || currentJob.status !== JobStatus.Running) {
          this.cleanupJob(job.id);
          return;
        }

        if (activeWorkerCount >= job.max_workers) {
          setTimeout(processNext, 100);
          return;
        }

        const queueDepth = this.db.getQueueDepth(job.id);
        isThrottled = queueDepth > job.max_queue_size;

        const batch = this.db.claimPendingUrls(job.id, 1);

        if (batch.length === 0) {
          if (activeWorkerCount === 0) {
            this.db.updateJobStatus(job.id, JobStatus.Completed);
            this.exportPData();
            this.sse.log('info', `Job #${job.id} completed`);
            this.sse.emit('job_status', { jobId: job.id, status: 'completed' });
            this.cleanupJob(job.id);
            return;
          }
          setTimeout(processNext, 100);
          return;
        }

        const urlRow = batch[0];

        const delay = this.getRateLimitDelay(urlRow.url);
        if (delay > 0) {
          this.db.unclaimUrl(urlRow.id);
          setTimeout(processNext, delay);
          return;
        }

        this.markDomainHit(urlRow.url);
        activeWorkerCount++;

        this.spawnWorker(urlRow, job, activeWorkerCount, () => {
          activeWorkerCount--;
          this.recordCompletion();
          setImmediate(processNext);
        });

        setImmediate(processNext);
      } catch (err) {
        this.logger.warn(`processNext error (retrying): ${(err as Error).message}`);
        setTimeout(processNext, 500);
      }
    };

    processNext();
  }

  private spawnWorker(
    urlRow: UrlRow,
    job: JobRow,
    currentActiveWorkers: number,
    onComplete: () => void,
  ): void {
    const workerPath = path.resolve(__dirname, 'worker', 'crawler.worker.js');
    const worker = new Worker(workerPath);

    const task: WorkerTask = {
      url: urlRow.url,
      jobId: job.id,
      depth: urlRow.depth,
      originUrl: urlRow.origin_url,
    };

    const timeout = setTimeout(() => {
      worker.terminate();
      this.db.markUrlFailed(urlRow.id);
      this.sse.log('warn', `Timeout: ${urlRow.url}`);
      onComplete();
    }, WORKER_TIMEOUT_MS);

    worker.on('message', (msg: WorkerMessage) => {
      clearTimeout(timeout);

      if (msg.type === 'result') {
        if (job.same_domain && msg.finalUrl && !this.effectiveDomain.has(job.id)) {
          try {
            const domain = this.extractRootDomain(new URL(msg.finalUrl).hostname);
            this.effectiveDomain.set(job.id, domain);
            this.logger.log(`Job #${job.id} effective domain: ${domain} (from ${msg.finalUrl})`);
          } catch { /* keep using origin */ }
        }

        this.db.markUrlCompleted(urlRow.id, msg.title, msg.bodyText);

        const terms = buildTermFrequencies(msg.title, msg.bodyText);
        if (terms.size > 0) {
          this.db.indexTerms(urlRow.id, terms);
        }

        if (urlRow.depth < job.max_depth) {
          this.enqueueDiscoveredLinks(msg.links, urlRow, job, currentActiveWorkers);
        }

        this.sse.emit('url_processed', {
          url: urlRow.url,
          depth: urlRow.depth,
          linksFound: msg.links.length,
          title: msg.title,
        });
      } else {
        this.db.markUrlFailed(urlRow.id);
        this.sse.log('warn', `Failed: ${urlRow.url} — ${msg.error}`);
      }

      worker.terminate();
      onComplete();
    });

    worker.on('error', (err) => {
      clearTimeout(timeout);
      this.db.markUrlFailed(urlRow.id);
      this.sse.log('error', `Worker error: ${err.message}`);
      onComplete();
    });

    worker.postMessage(task);
  }

  private enqueueDiscoveredLinks(
    links: string[],
    urlRow: UrlRow,
    job: JobRow,
    activeWorkers: number,
  ): void {
    let currentQueueDepth = this.db.getQueueDepth(job.id);
    const throttled = currentQueueDepth >= job.max_queue_size;

    if (throttled) {
      this.sse.emit('backpressure', {
        isThrottled: true,
        queueDepth: currentQueueDepth,
        maxQueueSize: job.max_queue_size,
        activeWorkers,
        maxWorkers: job.max_workers,
      });
    }

    let originDomain: string | undefined;
    if (job.same_domain) {
      originDomain = this.effectiveDomain.get(job.id);
      if (!originDomain) {
        try {
          originDomain = this.extractRootDomain(new URL(job.origin_url).hostname);
        } catch { /* fall through — enqueue all */ }
      }
    }

    let enqueued = 0;
    for (const link of links) {
      if (currentQueueDepth + enqueued >= job.max_queue_size) break;

      if (originDomain) {
        try {
          if (this.extractRootDomain(new URL(link).hostname) !== originDomain) continue;
        } catch { continue; }
      }

      const isNew = this.db.enqueueUrl(
        job.id,
        link,
        job.origin_url,
        urlRow.depth + 1,
      );
      if (isNew) enqueued++;
    }
    if (enqueued > 0) {
      this.sse.log('info', `+${enqueued} links from ${urlRow.url}`);
    }
  }

  /**
   * Extract the registrable root domain from a hostname.
   * "en.wikipedia.org" → "wikipedia.org"
   * "www.example.com"  → "example.com"
   * "blog.news.co.uk"  → "news.co.uk"
   */
  private extractRootDomain(hostname: string): string {
    const parts = hostname.split('.');
    if (parts.length <= 2) return hostname;
    const ccSlds = ['co', 'com', 'org', 'net', 'ac', 'gov', 'edu'];
    if (parts.length >= 3 && ccSlds.includes(parts[parts.length - 2])) {
      return parts.slice(-3).join('.');
    }
    return parts.slice(-2).join('.');
  }

  // --- Rate limiting ---

  private getRateLimitDelay(url: string): number {
    try {
      const hostname = new URL(url).hostname;
      const lastHit = this.domainLastHit.get(hostname);
      if (!lastHit) return 0;
      const elapsed = Date.now() - lastHit;
      return elapsed < RATE_LIMIT_MS ? RATE_LIMIT_MS - elapsed : 0;
    } catch {
      return 0;
    }
  }

  private markDomainHit(url: string): void {
    try {
      this.domainLastHit.set(new URL(url).hostname, Date.now());
    } catch { /* ignore malformed URLs */ }
  }

  // --- Throughput tracking ---

  private recordCompletion(): void {
    this.completionTimestamps.push(Date.now());
  }

  private getPagesPerSecond(): number {
    const now = Date.now();
    const cutoff = now - ROLLING_WINDOW_MS;
    this.completionTimestamps = this.completionTimestamps.filter((t) => t > cutoff);
    if (this.completionTimestamps.length === 0) return 0;
    const windowSec = (now - this.completionTimestamps[0]) / 1000;
    return windowSec > 0 ? this.completionTimestamps.length / windowSec : 0;
  }

  private emitMetrics(
    jobId: number,
    activeWorkers: number,
    isThrottled: boolean,
  ): void {
    const metrics: MetricsEvent = {
      indexedPages: this.db.getIndexedCount(jobId),
      queueDepth: this.db.getQueueDepth(jobId),
      activeWorkers,
      isThrottled,
      pagesPerSecond: Math.round(this.getPagesPerSecond() * 10) / 10,
    };
    this.sse.emit('metrics', metrics);
  }

  private cleanupJob(jobId: number): void {
    const entry = this.activeJobs.get(jobId);
    if (entry) {
      clearInterval(entry.interval);
      this.activeJobs.delete(jobId);
    }
    this.effectiveDomain.delete(jobId);
  }

  cancelJob(jobId: number): void {
    this.db.updateJobStatus(jobId, JobStatus.Cancelled);
    this.cleanupJob(jobId);
    this.sse.log('info', `Job #${jobId} cancelled`);
    this.sse.emit('job_status', { jobId, status: 'cancelled' });
  }

  getJob(jobId: number): JobRow | undefined {
    return this.db.getJob(jobId);
  }

  private exportPData(): void {
    try {
      const rows = this.db.exportTermsFlat();
      const dir = path.resolve(process.cwd(), 'data', 'storage');
      fs.mkdirSync(dir, { recursive: true });
      const lines = rows.map(
        (r) => `${r.term} ${r.url} ${r.origin_url} ${r.depth} ${r.frequency}`,
      );
      fs.writeFileSync(path.join(dir, 'p.data'), lines.join('\n'), 'utf-8');
      this.logger.log(`Exported ${rows.length} entries to data/storage/p.data`);
    } catch (err) {
      this.logger.error(`Failed to export p.data: ${err}`);
    }
  }
}
