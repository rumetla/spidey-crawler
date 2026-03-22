/**
 * Worker thread for fetching and parsing web pages.
 * Communicates with the main thread via parentPort messages.
 *
 * Receives: WorkerTask (url, jobId, depth, originUrl)
 * Sends:    WorkerResult | WorkerError
 */
import { parentPort } from 'worker_threads';
import { WorkerTask, WorkerMessage } from '../../common/interfaces';
import { parsePage } from './html-parser';

if (!parentPort) {
  throw new Error('This file must be run as a worker thread');
}

parentPort.on('message', async (task: WorkerTask) => {
  try {
    const response = await fetch(task.url, {
      signal: AbortSignal.timeout(10_000),
      headers: {
        'User-Agent': 'SpideyCrawler/1.0',
        Accept: 'text/html',
      },
    });

    if (!response.ok) {
      parentPort!.postMessage({
        type: 'error',
        url: task.url,
        error: `HTTP ${response.status}`,
      } satisfies WorkerMessage);
      return;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      parentPort!.postMessage({
        type: 'error',
        url: task.url,
        error: `Non-HTML content: ${contentType}`,
      } satisfies WorkerMessage);
      return;
    }

    const html = await response.text();
    const parsed = parsePage(html, task.url);

    parentPort!.postMessage({
      type: 'result',
      url: task.url,
      title: parsed.title,
      bodyText: parsed.bodyText,
      links: parsed.links,
    } satisfies WorkerMessage);
  } catch (err) {
    parentPort!.postMessage({
      type: 'error',
      url: task.url,
      error: err instanceof Error ? err.message : String(err),
    } satisfies WorkerMessage);
  }
});
