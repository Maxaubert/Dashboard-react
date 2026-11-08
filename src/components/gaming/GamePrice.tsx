import type { WishlistGame } from '@/api/types';
import { cn } from '@/lib/cn';
import { PTAG_LABEL, ptagsArr } from '@/lib/gaming';

export function GamePriceTags({ game, className }: { game: WishlistGame; className: string }) {
  const tags = ptagsArr(game);
  if (tags.length === 0) return null;
  return (
    <div className={className}>
      {tags.map((t) => {
        const def = PTAG_LABEL[t] ?? { cls: 'ptag-good', label: t };
        return (
          <span key={t} className={cn('ptag', def.cls)}>
            {def.label}
          </span>
        );
      })}
    </div>
  );
}

export function GamePriceSummary({ game }: { game: WishlistGame }) {
  return (
    <>
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
    </>
  );
}
