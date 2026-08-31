import { useEffect, useRef, type ReactNode } from 'react';
import { RefreshCw, Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Props {
  query: string;
  onQueryChange: (query: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
  /** Nothing to search or rebuild yet (loading, error, empty list). */
  disabled?: boolean;
  /** Optional controls rendered at the far right (e.g. "Koble fra"). */
  trailing?: ReactNode;
}

/**
 * Filter bar of the gaming overlay: a free-text search over the wishlist
 * plus a manual "Oppdater" that forces a server-side rebuild.
 */
export function GamingSearchBar({
  query,
  onQueryChange,
  onRefresh,
  refreshing,
  disabled = false,
  trailing,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the field as soon as there is something to search (also covers
  // the mount-while-loading case that `autoFocus` would miss).
  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  // The overlay is a Radix Dialog whose Escape handler runs on the document
  // in the capture phase, before React's delegated onKeyDown. Clearing the
  // query therefore has to happen in a capture listener too, and only while
  // the field holds text so an empty field still lets Escape close the overlay.
  useEffect(() => {
    if (!query) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.activeElement !== inputRef.current) return;
      e.stopPropagation();
      e.preventDefault();
      onQueryChange('');
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [query, onQueryChange]);

  return (
    <div className="gaming-filter-bar">
      <div className="gaming-search">
        <Search className="gaming-search-icon" size={14} strokeWidth={2} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          className="gaming-search-input"
          placeholder="Søk i ønskelisten…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Søk i ønskelisten"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
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
        disabled={disabled || refreshing}
        aria-busy={refreshing}
      >
        <RefreshCw size={13} strokeWidth={2} aria-hidden="true" />
        {refreshing ? 'Oppdaterer…' : 'Oppdater'}
      </button>
      {trailing}
    </div>
  );
}
