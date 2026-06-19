import type { WishlistGame } from '@/api/types';

/** On-sale games first (deepest discount first), then the rest by wishlist priority. */
export function orderForCarousel(games: WishlistGame[]): WishlistGame[] {
  const onSale = games.filter((game) => game.onSale).sort((a, b) => b.discount - a.discount);
  const rest = games.filter((game) => !game.onSale).sort((a, b) => a.priority - b.priority);
  return [...onSale, ...rest];
}
