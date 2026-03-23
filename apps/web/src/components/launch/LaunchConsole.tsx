'use client';

import { useState } from 'react';
import { createCrawlJob, cancelJob } from '@/lib/api';

interface LaunchConsoleProps {
  activeJobId: number | null;
  jobFinished: boolean;
  onJobStarted?: (jobId: number) => void;
  onJobCancelled?: () => void;
}

export function LaunchConsole({ activeJobId, jobFinished, onJobStarted, onJobCancelled }: LaunchConsoleProps) {
  const [originUrl, setOriginUrl] = useState('');
  const [maxDepth, setMaxDepth] = useState(2);
  const [maxWorkers, setMaxWorkers] = useState(4);
  const [maxQueueSize, setMaxQueueSize] = useState(1000);
  const [sameDomain, setSameDomain] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRunning = activeJobId !== null && !jobFinished;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await createCrawlJob({
        originUrl,
        maxDepth,
        maxWorkers,
        maxQueueSize,
        sameDomain,
      });
      onJobStarted?.(result.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start job');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!activeJobId) return;
    setLoading(true);
    try {
      await cancelJob(activeJobId);
      onJobCancelled?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-border">
      <div className="border-b border-border px-4 py-2 bg-surface-raised">
        <span className="text-[10px] uppercase tracking-widest text-text-muted">
          Launch Console
        </span>
      </div>
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-text-muted mb-1">
            Origin URL
          </label>
          <input
            type="url"
            value={originUrl}
            onChange={(e) => setOriginUrl(e.target.value)}
            placeholder="https://example.com"
            required
            disabled={isRunning}
            className="w-full bg-surface border border-border px-3 py-2 text-sm text-text-primary
                       placeholder:text-text-muted/50 focus:border-accent focus:outline-none
                       disabled:opacity-50"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-text-muted mb-1">
              Max Depth (k)
            </label>
            <input
              type="number"
              value={maxDepth}
              onChange={(e) => setMaxDepth(Number(e.target.value))}
              min={1}
              max={10}
              disabled={isRunning}
              className="w-full bg-surface border border-border px-3 py-2 text-sm text-text-primary
                         focus:border-accent focus:outline-none tabular-nums disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-text-muted mb-1">
              Max Workers
            </label>
            <input
              type="number"
              value={maxWorkers}
              onChange={(e) => setMaxWorkers(Number(e.target.value))}
              min={1}
              max={16}
              disabled={isRunning}
              className="w-full bg-surface border border-border px-3 py-2 text-sm text-text-primary
                         focus:border-accent focus:outline-none tabular-nums disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-text-muted mb-1">
              Queue Ceiling
            </label>
            <input
              type="number"
              value={maxQueueSize}
              onChange={(e) => setMaxQueueSize(Number(e.target.value))}
              min={10}
              max={10000}
              disabled={isRunning}
              className="w-full bg-surface border border-border px-3 py-2 text-sm text-text-primary
                         focus:border-accent focus:outline-none tabular-nums disabled:opacity-50"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={sameDomain}
            onChange={(e) => setSameDomain(e.target.checked)}
            disabled={isRunning}
            className="accent-accent"
          />
          <span className="text-xs text-text-muted">Same domain only</span>
        </label>

        {error && (
          <div className="text-danger text-xs border border-danger/30 bg-danger/10 px-3 py-2">
            {error}
          </div>
        )}

        {isRunning ? (
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="w-full border border-danger text-danger px-4 py-2 text-sm uppercase tracking-widest
                       hover:bg-danger hover:text-surface transition-colors
                       disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {loading ? 'Cancelling...' : 'Cancel Crawl'}
          </button>
        ) : (
          <button
            type="submit"
            disabled={loading || !originUrl}
            className="w-full border border-accent text-accent px-4 py-2 text-sm uppercase tracking-widest
                       hover:bg-accent hover:text-surface transition-colors
                       disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {loading ? 'Initializing...' : 'Start Crawl'}
          </button>
        )}
      </form>
    </div>
  );
}
