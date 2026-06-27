import { useMemo } from 'react';
import { useLinks } from '@/hooks/useLinks';
import { usePageOverlay } from '@/context/PageOverlayContext';
import { LinkIconRender } from '@/components/links/LinkCard';
import type { LinkItem } from '@/api/types';
import { useBentoCarousel } from './useBentoCarousel';

/** Eksterne lenker — horizontal row of favourite link cards. */
export function LinksBentoCard() {
  const { openOverlay } = usePageOverlay();
  const { data: envelope } = useLinks();
  const links = envelope?.links ?? [];
  const favorites = useMemo(() => links.filter((l: LinkItem) => l.favorite), [links]);
  const scrollerRef = useBentoCarousel<HTMLDivElement>();

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
          favorites.map((link) => <LinkBentoTile key={link.id} link={link} />)
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
