import type { WishlistGame } from '@/api/types';
import { cn } from '@/lib/cn';
import { GamePriceSummary, GamePriceTags } from './GamePrice';

interface Props {
  game: WishlistGame;
  onClick: () => void;
}

/** One wishlist row in the gaming overlay: capsule image, name, genres, price column. */
export function GameCard({ game, onClick }: Props) {
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
        <GamePriceTags game={game} className="img-ptags" />
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
        <GamePriceSummary game={game} />
      </div>
    </div>
  );
}
