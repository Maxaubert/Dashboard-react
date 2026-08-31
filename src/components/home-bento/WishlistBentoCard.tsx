import { useMemo, useState } from 'react';
import { useWishlist, useSteamConnection } from '@/hooks/useWishlist';
import { useSteamConnect } from '@/hooks/useSteamConnect';
import { usePageOverlay } from '@/context/PageOverlayContext';
import { orderForCarousel } from '@/lib/wishlistOrder';
import { filterGames } from '@/lib/wishlistSearch';
import { GameModal } from '@/components/gaming/GameModal';
import type { WishlistGame } from '@/api/types';
import { useBentoCarousel } from './useBentoCarousel';
import { WishlistSearch } from './WishlistSearch';
import { GameTile } from './GameTile';

/** Ønskeliste — horizontal row of Steam wishlist game tiles. */
export function WishlistBentoCard() {
  const { openOverlay } = usePageOverlay();
  const { data: conn } = useSteamConnection();
  const { data: wl, isLoading, error } = useWishlist();
  const { connect, pending: connecting } = useSteamConnect();
  const [active, setActive] = useState<WishlistGame | null>(null);
  const [query, setQuery] = useState('');
  const scrollerRef = useBentoCarousel<HTMLDivElement>();

  const connected = wl?.connected ?? conn?.connected ?? false;
  const games = useMemo(() => orderForCarousel(wl?.games ?? []), [wl?.games]);
  const visible = useMemo(() => filterGames(games, query), [games, query]);

  return (
    <section className="bento-card area-wish">
      <div className="ch">
        <h2>Ønskeliste</h2>
        <div className="ch-tools">
          {connected && games.length > 0 && <WishlistSearch query={query} onQueryChange={setQuery} />}
          <button type="button" className="ch-link" onClick={() => openOverlay('gaming')}>
            Alle
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z" />
            </svg>
          </button>
        </div>
      </div>
      <div className="gscroll" ref={scrollerRef}>
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="gskel" />)
        ) : !connected ? (
          <div className="row-empty row-connect">
            <span>Koble til Steam for å vise ønskelisten.</span>
            <button type="button" className="row-connect-btn" onClick={connect} disabled={connecting}>
              Koble til Steam
            </button>
          </div>
        ) : error ? (
          <div className="row-empty">Kunne ikke laste ønskeliste.</div>
        ) : games.length === 0 ? (
          <div className="row-empty">Ønskelisten er tom.</div>
        ) : visible.length === 0 ? (
          <div className="row-empty">Ingen treff</div>
        ) : (
          visible.map((game) => (
            <GameTile key={game.appid} game={game} onClick={() => setActive(game)} />
          ))
        )}
      </div>
      {active && <GameModal game={active} onClose={() => setActive(null)} />}
    </section>
  );
}
