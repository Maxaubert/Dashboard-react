import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLinks } from '@/hooks/useLinks';
import { useDragScroll } from '@/hooks/useDragScroll';
import { LinkIconRender } from '@/components/links/LinkCard';
import type { LinkItem } from '@/api/types';
import { GripHandle, type HandleProps } from '@/components/home/GripHandle';

export function EksterneLenkerSection({ handleProps }: { handleProps?: HandleProps }) {
  const { data: envelope } = useLinks();
  const links = envelope?.links ?? [];
  const favorites = useMemo(
    () => links.filter((l: LinkItem) => l.favorite),
    [links]
  );

  // Render N copies of the favorites for infinite-loop scrolling. The
  // hook starts the user in the middle copy and snaps them by one copy
  // when they drift toward either edge. We need enough copies that the
  // total rendered width comfortably exceeds the viewport — when the
  // user has only a few favorites, that means rendering more copies, so
  // the wrap zone always has room. Targeting ~3500px of items ensures
  // wrap works on wide pages (1240px max) without going overboard.
  const copyCount = useMemo(() => {
    if (favorites.length === 0) return 0;
    const TARGET_WIDTH = 3500;
    const ESTIMATED_ITEM_W = 120;
    return Math.min(
      20,
      Math.max(5, Math.ceil(TARGET_WIDTH / (favorites.length * ESTIMATED_ITEM_W)))
    );
  }, [favorites.length]);

  const looped = useMemo(() => {
    if (favorites.length === 0) return [];
    return Array.from({ length: copyCount }, (_, c) =>
      favorites.map((l, i) => ({ ...l, _k: `${c}-${i}-${l.id}` }))
    ).flat();
  }, [favorites, copyCount]);

  const scrollerRef = useDragScroll<HTMLDivElement>({
    infinite: favorites.length > 0,
    copies: copyCount || 3,
  });

  return (
    <section>
      <div className="section-header">
        <span>
          <GripHandle handleProps={handleProps} />
          Eksterne lenker
        </span>
        <Link to="/links" className="section-header-link">
          Alle
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z" />
          </svg>
        </Link>
      </div>
      <div className="ext-grid-wrap">
        <div className="ext-grid" ref={scrollerRef}>
          {favorites.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem', padding: '8px 0' }}>
              Ingen favoritter
            </div>
          ) : (
            looped.map((link) => <ExternalLinkCard key={link._k} link={link} />)
          )}
        </div>
      </div>
    </section>
  );
}

function ExternalLinkCard({ link }: { link: LinkItem }) {
  const accent = link.color ?? 'var(--color-page-plan)';
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noreferrer noopener"
      className="ext-link"
      style={{ ['--ext-color' as string]: accent }}
    >
      <div className="ext-link-top">
        <div className="ext-link-icon-wrap">
          <LinkIconRender link={link} />
        </div>
        <svg
          className="ext-link-arrow"
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M14 3l-1.41 1.41L18.17 10H4v2h14.17l-5.58 5.59L14 19l8-8z" />
        </svg>
      </div>
      <div>
        <div className="ext-link-name">{link.name}</div>
        {link.sub && <div className="ext-link-sub">{link.sub}</div>}
      </div>
    </a>
  );
}
