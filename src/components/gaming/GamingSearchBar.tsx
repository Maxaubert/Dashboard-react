import type { ReactNode } from 'react';
import { RefreshCw, Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Props {
  query: string;
  onQueryChange: (query: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
  /** Optional controls rendered at the far right (e.g. "Koble fra"). */
  trailing?: ReactNode;
}

/**
 * Filter bar of the gaming overlay: a free-text search over the wishlist
 * plus a manual "Oppdater" that forces a server-side rebuild.
 */
export function GamingSearchBar({ query, onQueryChange, onRefresh, refreshing, trailing }: Props) {
  return (
    <div className="gaming-filter-bar">
      <div className="gaming-search">
        <Search className="gaming-search-icon" size={14} strokeWidth={2} aria-hidden="true" />
        <input
          type="search"
          className="gaming-search-input"
          placeholder="Søk i ønskelisten…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && query) {
              e.preventDefault();
              onQueryChange('');
            }
          }}
          aria-label="Søk i ønskelisten"
          autoComplete="off"
          spellCheck={false}
          autoFocus
        />
        {query && (
          <button
            type="button"
            className="gaming-search-clear"
            onClick={() => onQueryChange('')}
            aria-label="Tøm søk"
            title="Tøm søk"
          >
            <X size={13} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>
      <button
        type="button"
        className={cn('gaming-filter-btn gaming-refresh-btn', refreshing && 'is-busy')}
        onClick={onRefresh}
        disabled={refreshing}
        aria-busy={refreshing}
      >
        <RefreshCw size={13} strokeWidth={2} aria-hidden="true" />
        {refreshing ? 'Oppdaterer…' : 'Oppdater'}
      </button>
      {trailing}
    </div>
  );
}
