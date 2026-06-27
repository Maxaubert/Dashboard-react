import { useState } from 'react';
import { useWishlist, useSteamConnection } from '@/hooks/useWishlist';
import { usePageOverlay } from '@/context/PageOverlayContext';
import { orderForCarousel } from '@/lib/wishlistOrder';
import { GameModal } from '@/components/gaming/GameModal';
import type { WishlistGame } from '@/api/types';
import { useBentoCarousel } from './useBentoCarousel';

/** Ønskeliste — horizontal row of Steam wishlist game tiles. */
export function WishlistBentoCard() {
  const { openOverlay } = usePageOverlay();
  const { data: conn } = useSteamConnection();
  const { data: wl, isLoading } = useWishlist();
  const [active, setActive] = useState<WishlistGame | null>(null);
  const scrollerRef = useBentoCarousel<HTMLDivElement>();

  const connected = wl?.connected ?? conn?.connected ?? false;
  const games = orderForCarousel(wl?.games ?? []);

  return (
    <section className="bento-card area-wish">
      <div className="ch">
        <h2>Ønskeliste</h2>
        <button type="button" className="ch-link" onClick={() => openOverlay('gaming')}>
          Alle
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z" />
          </svg>
        </button>
      </div>
      <div className="gscroll" ref={scrollerRef}>
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="gskel" />)
        ) : !connected ? (
          <div className="row-empty">Koble til Steam for å vise ønskelisten.</div>
        ) : games.length === 0 ? (
          <div className="row-empty">Ønskelisten er tom.</div>
        ) : (
          games.map((game) => (
            <GameTile key={game.appid} game={game} onClick={() => setActive(game)} />
          ))
        )}
      </div>
      {active && <GameModal game={active} onClose={() => setActive(null)} />}
    </section>
  );
}

function GameTile({ game, onClick }: { game: WishlistGame; onClick: () => void }) {
  return (
    <button type="button" className="gtile" onClick={onClick} title={game.name}>
      <img
        src={game.imgUrl}
        alt={game.name}
        loading="lazy"
        onError={(e) => {
          const img = e.target as HTMLImageElement;
          if (game.imgFallback && img.src !== game.imgFallback) img.src = game.imgFallback;
          else img.style.display = 'none';
        }}
      />
      <div className="gg" />
      {game.onSale && <span className="gb">-{game.discount}%</span>}
      <div className="gm">
        <div className="gn">{game.name}</div>
        <div className="gp">
          {game.isFree ? (
            'Gratis'
          ) : (
            <>
              {game.price && <span>{game.price}</span>}
              {game.onSale && game.origPrice && <s>{game.origPrice}</s>}
            </>
          )}
        </div>
      </div>
    </button>
  );
}
