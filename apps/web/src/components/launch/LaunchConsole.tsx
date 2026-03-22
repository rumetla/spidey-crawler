'use client';

import { useState } from 'react';
import { createCrawlJob } from '@/lib/api';

interface LaunchConsoleProps {
  onJobStarted?: (jobId: number) => void;
}

export function LaunchConsole({ onJobStarted }: LaunchConsoleProps) {
  const [originUrl, setOriginUrl] = useState('');
  const [maxDepth, setMaxDepth] = useState(2);
  const [maxWorkers, setMaxWorkers] = useState(4);
  const [maxQueueSize, setMaxQueueSize] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      });
      onJobStarted?.(result.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start job');
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
            className="w-full bg-surface border border-border px-3 py-2 text-sm text-text-primary
                       placeholder:text-text-muted/50 focus:border-accent focus:outline-none"
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
              className="w-full bg-surface border border-border px-3 py-2 text-sm text-text-primary
                         focus:border-accent focus:outline-none tabular-nums"
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
              className="w-full bg-surface border border-border px-3 py-2 text-sm text-text-primary
                         focus:border-accent focus:outline-none tabular-nums"
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
              className="w-full bg-surface border border-border px-3 py-2 text-sm text-text-primary
                         focus:border-accent focus:outline-none tabular-nums"
            />
          </div>
        </div>

        {error && (
          <div className="text-danger text-xs border border-danger/30 bg-danger/10 px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !originUrl}
          className="w-full border border-accent text-accent px-4 py-2 text-sm uppercase tracking-widest
                     hover:bg-accent hover:text-surface transition-colors
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {loading ? 'Initializing...' : 'Start Crawl'}
        </button>
      </form>
    </div>
  );
}
