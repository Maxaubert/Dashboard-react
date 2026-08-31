import type { WishlistGame } from '@/api/types';
import { cn } from '@/lib/cn';
import { PTAG_LABEL, ptagsArr } from '@/lib/gaming';

interface Props {
  game: WishlistGame;
  onClick: () => void;
}

/** One wishlist row in the gaming overlay: capsule image, name, genres, price column. */
export function GameCard({ game, onClick }: Props) {
  const tags = ptagsArr(game);
  return (
    <div
      className={cn('game-card', game.onSale && 'on-sale')}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="game-img-wrap">
        <img
          className="game-img"
          src={game.imgUrl}
          alt={game.name}
          loading="lazy"
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            if (game.imgFallback && img.src !== game.imgFallback) img.src = game.imgFallback;
            else img.style.display = 'none';
          }}
        />
        {tags.length > 0 && (
          <div className="img-ptags">
            {tags.map((t) => {
              const def = PTAG_LABEL[t] ?? { cls: 'ptag-good', label: t };
              return (
                <span key={t} className={cn('ptag', def.cls)}>
                  {def.label}
                </span>
              );
            })}
          </div>
        )}
      </div>
      <div className="game-info">
        <div className="game-name">{game.name}</div>
        <div className="game-tags">
          {game.genres.map((t) => (
            <span key={t} className="game-tag">{t}</span>
          ))}
        </div>
      </div>
      <div className="game-price-col">
        {game.onSale && <span className="sale-badge">-{game.discount}%</span>}
        {game.onSale && game.origPrice && (
          <span className="game-orig-price">{game.origPrice}</span>
        )}
        {game.isFree ? (
          <span className="game-price free">Gratis</span>
        ) : game.price ? (
          <span className="game-price">{game.price}</span>
        ) : (
          <span className="price-na">Ikke tilgjengelig</span>
        )}
      </div>
    </div>
  );
}
