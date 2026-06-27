import { useMemo } from 'react';
import { useLinks } from '@/hooks/useLinks';
import { usePageOverlay } from '@/context/PageOverlayContext';
import { LinkIconRender } from '@/components/links/LinkCard';
import type { LinkItem } from '@/api/types';
import { useBentoCarousel } from './useBentoCarousel';

/** Eksterne lenker — circular (infinite-loop) row of favourite link cards. */
export function LinksBentoCard() {
  const { openOverlay } = usePageOverlay();
  const { data: envelope } = useLinks();
  const links = envelope?.links ?? [];
  const favorites = useMemo(() => links.filter((l: LinkItem) => l.favorite), [links]);

  // Render N identical copies so the row can loop seamlessly. Target ~3500px
  // of items so the wrap zone has room even on wide screens; more copies when
  // there are few favourites (mirrors the legacy home favourites carousel).
  const copyCount = useMemo(() => {
    if (favorites.length === 0) return 0;
    const TARGET_WIDTH = 3500;
    const ESTIMATED_ITEM_W = 188; // ~176 card + 12 gap
    return Math.min(20, Math.max(5, Math.ceil(TARGET_WIDTH / (favorites.length * ESTIMATED_ITEM_W))));
  }, [favorites.length]);

  const looped = useMemo(() => {
    if (favorites.length === 0) return [];
    return Array.from({ length: copyCount }, (_, c) =>
      favorites.map((l, i) => ({ ...l, _k: `${c}-${i}-${l.id}` })),
    ).flat();
  }, [favorites, copyCount]);

  const scrollerRef = useBentoCarousel<HTMLDivElement>({
    infinite: favorites.length > 0,
    copies: copyCount || 3,
  });

  return (
    <section className="bento-card area-lenk">
      <div className="ch">
        <h2>Eksterne lenker</h2>
        <button type="button" className="ch-link" onClick={() => openOverlay('links')}>
          Alle
        </button>
      </div>
      <div className="lrow" ref={scrollerRef}>
        {favorites.length === 0 ? (
          <div className="row-empty">Ingen favoritter enda.</div>
        ) : (
          looped.map((link) => <LinkBentoTile key={link._k} link={link} />)
        )}
      </div>
    </section>
  );
}

function LinkBentoTile({ link }: { link: LinkItem }) {
  const accent = link.color ?? '#9fd07a';
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noreferrer noopener"
      className="lcard"
      style={{ ['--lc' as string]: accent }}
    >
      <div className="ltop">
        <span className="lic">
          <LinkIconRender link={link} />
        </span>
        <svg className="larr" width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 3l-1.41 1.41L18.17 10H4v2h14.17l-5.58 5.59L14 19l8-8z" />
        </svg>
      </div>
      <div>
        <div className="ln">{link.name}</div>
        {link.sub && <div className="ls">{link.sub}</div>}
      </div>
    </a>
  );
}
