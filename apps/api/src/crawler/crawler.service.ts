import { Injectable, Logger } from '@nestjs/common';
import { Worker } from 'worker_threads';
import * as path from 'path';
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

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);
  private activeJobs = new Map<number, { workers: Worker[]; interval: NodeJS.Timeout }>();

  constructor(
    private readonly db: DatabaseService,
    private readonly sse: SSEService,
  ) {}

  /** Launch a new crawl job */
  startJob(
    originUrl: string,
    maxDepth: number,
    maxWorkers = 4,
    maxQueueSize = 1000,
  ): JobRow {
    const job = this.db.createJob(originUrl, maxDepth, maxWorkers, maxQueueSize);
    this.logger.log(`Job ${job.id} created: ${originUrl} (depth=${maxDepth})`);

    // Enqueue the seed URL at depth 0 — marked visited immediately
    this.db.enqueueUrl(job.id, originUrl, originUrl, 0);

    this.sse.log('info', `Crawl job #${job.id} started: ${originUrl}`);
    this.runCrawlLoop(job);

    return job;
  }

  /** Main BFS crawl loop — spins up workers and feeds them URLs */
  private runCrawlLoop(job: JobRow): void {
    const workers: Worker[] = [];
    let activeWorkerCount = 0;
    let isThrottled = false;

    const metricsInterval = setInterval(() => {
      this.emitMetrics(job.id, activeWorkerCount, isThrottled);
    }, 500);

    this.activeJobs.set(job.id, { workers, interval: metricsInterval });

    const processNext = (): void => {
      const currentJob = this.db.getJob(job.id);
      if (!currentJob || currentJob.status !== JobStatus.Running) {
        this.cleanupJob(job.id);
        return;
      }

      const queueDepth = this.db.getQueueDepth(job.id);

      // Back pressure: throttle if queue is too deep or too many workers
      if (activeWorkerCount >= job.max_workers) {
        isThrottled = true;
        setTimeout(processNext, 100);
        return;
      }

      isThrottled = queueDepth > job.max_queue_size;
      if (isThrottled) {
        this.sse.emit('backpressure', {
          isThrottled: true,
          queueDepth,
          maxQueueSize: job.max_queue_size,
          activeWorkers: activeWorkerCount,
          maxWorkers: job.max_workers,
        });
        setTimeout(processNext, 200);
        return;
      }

      // Claim a batch of pending URLs
      const batch = this.db.claimPendingUrls(job.id, 1);

      if (batch.length === 0) {
        // No pending URLs and no active workers → job complete
        if (activeWorkerCount === 0) {
          this.db.updateJobStatus(job.id, JobStatus.Completed);
          this.sse.log('info', `Job #${job.id} completed`);
          this.sse.emit('job_status', { jobId: job.id, status: 'completed' });
          this.cleanupJob(job.id);
          return;
        }
        // Workers still active — wait for them
        setTimeout(processNext, 100);
        return;
      }

      const urlRow = batch[0];
      activeWorkerCount++;

      this.spawnWorker(urlRow, job, () => {
        activeWorkerCount--;
        // Immediately try to process more
        setImmediate(processNext);
      });

      // Kick off next URL processing without waiting
      setImmediate(processNext);
    };

    processNext();
  }

  /** Spawn a worker thread to fetch and parse a single URL */
  private spawnWorker(
    urlRow: UrlRow,
    job: JobRow,
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
    }, 15_000);

    worker.on('message', (msg: WorkerMessage) => {
      clearTimeout(timeout);

      if (msg.type === 'result') {
        this.db.markUrlCompleted(urlRow.id, msg.title, msg.bodyText);

        // Build and store inverted index
        const terms = buildTermFrequencies(msg.title, msg.bodyText);
        if (terms.size > 0) {
          this.db.indexTerms(urlRow.id, terms);
        }

        // Enqueue discovered links (only if within depth limit)
        if (urlRow.depth < job.max_depth) {
          let enqueued = 0;
          for (const link of msg.links) {
            // Visited-on-enqueue: prevents race conditions across workers
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
      pagesPerSecond: 0, // TODO: calculate rolling average
    };
    this.sse.emit('metrics', metrics);
  }

  private cleanupJob(jobId: number): void {
    const entry = this.activeJobs.get(jobId);
    if (entry) {
      clearInterval(entry.interval);
      entry.workers.forEach((w) => w.terminate());
      this.activeJobs.delete(jobId);
    }
  }

  /** Cancel a running job */
  cancelJob(jobId: number): void {
    this.db.updateJobStatus(jobId, JobStatus.Cancelled);
    this.cleanupJob(jobId);
    this.sse.log('info', `Job #${jobId} cancelled`);
  }

  getJob(jobId: number): JobRow | undefined {
    return this.db.getJob(jobId);
  }
}
