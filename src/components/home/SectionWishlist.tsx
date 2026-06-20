import { useState } from 'react';
import { useWishlist, useSteamConnection } from '@/hooks/useWishlist';
import { usePageOverlay } from '@/context/PageOverlayContext';
import { useDragScroll } from '@/hooks/useDragScroll';
import { orderForCarousel } from '@/lib/wishlistOrder';
import { steamApi } from '@/api/steam';
import { GameModal } from '@/components/gaming/GameModal';
import { GripHandle, type HandleProps } from '@/components/home/GripHandle';
import type { WishlistGame } from '@/api/types';

export function WishlistSection({ handleProps }: { handleProps?: HandleProps }) {
  const { openOverlay } = usePageOverlay();
  const { data: conn } = useSteamConnection();
  const { data: wl, isLoading } = useWishlist();
  const [active, setActive] = useState<WishlistGame | null>(null);

  const connected = wl?.connected ?? conn?.connected ?? false;
  const games = orderForCarousel(wl?.games ?? []);
  const scrollerRef = useDragScroll<HTMLDivElement>({ infinite: false });

  return (
    <section>
      <div className="section-header">
        <span>
          <GripHandle handleProps={handleProps} />
          Steam ønskeliste
        </span>
        <button type="button" className="section-header-link" onClick={() => openOverlay('gaming')}>
          Alle
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z" />
          </svg>
        </button>
      </div>

      {!connected && !isLoading ? (
        <div className="wishlist-connect-box">
          <p>Koble til Steam for å vise ønskelisten din.</p>
          <p className="wishlist-connect-hint">Ønskelisten din på Steam må være offentlig.</p>
          <button className="gaming-filter-btn active" onClick={() => steamApi.startConnect()}>
            Koble til Steam
          </button>
        </div>
      ) : (
        <div className="ext-grid-wrap">
          <div className="ext-grid wishlist-strip" ref={scrollerRef}>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="wishlist-cover wishlist-cover-skeleton" />
              ))
            ) : games.length === 0 ? (
              <div className="wishlist-empty-note">Ønskelisten er tom</div>
            ) : (
              games.map((game) => (
                <WishlistCover key={game.appid} game={game} onClick={() => setActive(game)} />
              ))
            )}
          </div>
        </div>
      )}

      {active && <GameModal game={active} onClose={() => setActive(null)} />}
    </section>
  );
}

function WishlistCover({ game, onClick }: { game: WishlistGame; onClick: () => void }) {
  return (
    <button type="button" className="wishlist-cover" onClick={onClick} title={game.name}>
      <div className="wishlist-cover-img">
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
        {game.onSale && <span className="wishlist-cover-badge">-{game.discount}%</span>}
        <div className="wishlist-cover-meta">
          {game.isFree ? (
            <span className="wishlist-price-now">Gratis</span>
          ) : game.onSale ? (
            <>
              <span className="wishlist-price-was">{game.origPrice}</span>
              <span className="wishlist-price-now sale">{game.price}</span>
            </>
          ) : (
            game.price && <span className="wishlist-price-now">{game.price}</span>
          )}
        </div>
      </div>
    </button>
  );
}
