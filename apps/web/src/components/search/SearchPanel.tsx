'use client';

import { useState } from 'react';
import { search } from '@/lib/api';
import type { SearchResult } from '@/lib/types';
import { SearchResultRow } from './SearchResult';

export function SearchPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    try {
      const res = await search(query.trim());
      setResults(res.results);
      setSearched(true);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="border border-border">
      <div className="border-b border-border px-4 py-2 bg-surface-raised">
        <span className="text-[10px] uppercase tracking-widest text-text-muted">
          Live Search
        </span>
      </div>

      <form onSubmit={handleSearch} className="p-4 flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search indexed pages..."
          className="flex-1 bg-surface border border-border px-3 py-2 text-sm text-text-primary
                     placeholder:text-text-muted/50 focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="border border-accent text-accent px-4 py-2 text-xs uppercase tracking-widest
                     hover:bg-accent hover:text-surface transition-colors
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {searching ? '...' : 'Query'}
        </button>
      </form>

      <div className="border-t border-border">
        {!searched ? (
          <div className="p-4 text-text-muted text-xs">
            Enter a query to search the live index.
          </div>
        ) : results.length === 0 ? (
          <div className="p-4 text-text-muted text-xs">
            No results found for &quot;{query}&quot;.
          </div>
        ) : (
          <div className="divide-y divide-border">
            <div className="px-4 py-2 text-[10px] uppercase tracking-widest text-text-muted">
              {results.length} result{results.length !== 1 && 's'}
            </div>
            {results.map((result, i) => (
              <SearchResultRow key={`${result.relevantUrl}-${i}`} result={result} rank={i + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
