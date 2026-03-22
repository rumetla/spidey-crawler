'use client';

import type { SearchResult } from '@/lib/types';

interface SearchResultRowProps {
  result: SearchResult;
  rank: number;
}

export function SearchResultRow({ result, rank }: SearchResultRowProps) {
  return (
    <div className="px-4 py-3 hover:bg-surface-raised transition-colors">
      <div className="flex items-start gap-3">
        <span className="text-text-muted text-xs tabular-nums shrink-0 pt-0.5">
          #{rank}
        </span>
        <div className="min-w-0 flex-1">
          <a
            href={result.relevantUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent text-sm hover:underline block truncate"
          >
            {result.title || result.relevantUrl}
          </a>
          <div className="text-text-muted text-xs mt-1 truncate">
            {result.relevantUrl}
          </div>
          <div className="flex gap-4 mt-1 text-[10px] uppercase tracking-widest text-text-muted">
            <span>
              origin: <span className="text-text-primary">{result.originUrl}</span>
            </span>
            <span>
              depth: <span className="text-text-primary">{result.depth}</span>
            </span>
            <span>
              score: <span className="text-accent">{result.score.toFixed(1)}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
