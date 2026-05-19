import { useEffect, useRef, useState } from 'react';
import { useNews } from '@/hooks/useNews';
import { useDragScroll } from '@/hooks/useDragScroll';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { NewsSource } from '@/api/news';
import type { NewsItem } from '@/api/types';
import { cn } from '@/lib/cn';
import { GripHandle, type HandleProps } from '@/components/home/GripHandle';

const NEWS_SOURCES: Array<{ value: NewsSource; label: string }> = [
  { value: 'vg', label: 'VG' },
  { value: 'nrk', label: 'NRK' },
  { value: 'aftenposten', label: 'Aftenposten' },
];

export function NyhetssakerSection({ handleProps }: { handleProps?: HandleProps }) {
  const [source, setSource] = useLocalStorage<NewsSource>('news-source', 'vg');
  const { data: news, isLoading, error } = useNews(source, 14);
  const scrollerRef = useDragScroll<HTMLDivElement>(); // inertia, not infinite

  return (
    <section>
      <div className="section-header">
        <span>
          <GripHandle handleProps={handleProps} />
          Nyhetssaker
        </span>
        <NewsSourceDropdown value={source} onChange={setSource} />
      </div>
      <div className="news-wrap">
        <div className="news-list" ref={scrollerRef}>
          {isLoading ? (
            <div className="news-loading">Laster nyheter…</div>
          ) : error ? (
            <div className="news-loading">Kunne ikke laste nyheter.</div>
          ) : (
            news?.map((item, i) => <NewsCard key={i} item={item} />)
          )}
        </div>
      </div>
    </section>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <a href={item.link} target="_blank" rel="noreferrer noopener" className="news-item">
      {item.img && (
        <div className="news-img">
          <img src={item.img} alt="" loading="lazy" />
        </div>
      )}
      <div className="news-overlay" />
      <div className="news-title">{item.title}</div>
    </a>
  );
}

/**
 * Custom dropdown for picking the news source. Replaces a native <select>
 * because Win11 renders <option> lists with rounded pill items inside a
 * lighter container, which clashes with the dashboard's flat dark theme
 * and isn't restyleable cross-browser.
 */
function NewsSourceDropdown({
  value,
  onChange,
}: {
  value: NewsSource;
  onChange: (v: NewsSource) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape so the popover behaves like a real menu.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = NEWS_SOURCES.find((s) => s.value === value);

  return (
    <div className="news-source-dropdown" ref={ref}>
      <button
        type="button"
        className="news-source-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {current?.label ?? value.toUpperCase()}
        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M7 10l5 5 5-5z" />
        </svg>
      </button>
      {open && (
        <div className="news-source-menu" role="listbox">
          {NEWS_SOURCES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="option"
              aria-selected={s.value === value}
              className={cn('news-source-option', s.value === value && 'active')}
              onClick={() => {
                onChange(s.value);
                setOpen(false);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
