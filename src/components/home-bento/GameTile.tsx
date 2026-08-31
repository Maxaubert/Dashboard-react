import type { WishlistGame } from '@/api/types';

interface Props {
  game: WishlistGame;
  onClick: () => void;
}

/** One capsule tile in the Ønskeliste bento row: image, discount badge, price. */
export function GameTile({ game, onClick }: Props) {
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
