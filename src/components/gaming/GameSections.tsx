import type { WishlistGame } from '@/api/types';
import { GameCard } from './GameCard';

interface Props {
  onSale: WishlistGame[];
  regular: WishlistGame[];
  onSelect: (game: WishlistGame) => void;
}

/** The two wishlist sections of the gaming overlay: on-sale first, then the rest. */
export function GameSections({ onSale, regular, onSelect }: Props) {
  return (
    <>
      {onSale.length > 0 && (
        <>
          <div className="gaming-section-label">På salg nå · {onSale.length} spill</div>
          <div className="games-grid">
            {onSale.map((g) => (
              <GameCard key={g.appid} game={g} onClick={() => onSelect(g)} />
            ))}
          </div>
          {regular.length > 0 && (
            <div className="gaming-section-label">Resten av ønskelisten</div>
          )}
        </>
      )}
      {regular.length > 0 && (
        <div className="games-grid">
          {regular.map((g) => (
            <GameCard key={g.appid} game={g} onClick={() => onSelect(g)} />
          ))}
        </div>
      )}
    </>
  );
}
