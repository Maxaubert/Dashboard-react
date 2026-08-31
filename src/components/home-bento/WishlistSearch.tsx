import { useEffect, useRef, useState } from 'react';

interface Props {
  query: string;
  onQueryChange: (query: string) => void;
}

/**
 * Compact search for the Ønskeliste card header. Collapsed to a single
 * icon button; expands into a ~180px field when clicked. Escape clears
 * the query and collapses, blur collapses only when the field is empty
 * so an active filter stays visible.
 */
export function WishlistSearch({ query, onQueryChange }: Props) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  // Set by an explicit close (Escape, clear) so keyboard focus lands on the
  // collapsed button instead of dropping to <body>. A blur-collapse must not
  // pull focus back from wherever the user moved it.
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (open || !restoreFocus.current) return;
    restoreFocus.current = false;
    btnRef.current?.focus();
  }, [open]);

  function close() {
    onQueryChange('');
    restoreFocus.current = true;
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        ref={btnRef}
        type="button"
        className="wsearch-btn"
        onClick={() => setOpen(true)}
        aria-label="Søk i ønskelisten"
        title="Søk i ønskelisten"
      >
        <SearchIcon />
      </button>
    );
  }

  return (
    <div className="wsearch" role="search">
      <SearchIcon />
      <input
        type="search"
        className="wsearch-input"
        placeholder="Søk…"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            close();
          }
        }}
        onBlur={() => {
          if (!query.trim()) setOpen(false);
        }}
        aria-label="Søk i ønskelisten"
        autoComplete="off"
        spellCheck={false}
        autoFocus
      />
      <button
        type="button"
        className="wsearch-btn wsearch-clear"
        onMouseDown={(e) => e.preventDefault()}
        onClick={close}
        aria-label="Tøm søk"
        title="Tøm søk"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="wsearch-icon">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}
