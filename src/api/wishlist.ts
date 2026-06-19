import type { WishlistGame } from './types';

export const wishlistApi = {
  list: async (): Promise<WishlistGame[]> => {
    const res = await fetch('/api/wishlist');
    if (!res.ok) throw new Error(`wishlist ${res.status}`);
    return res.json();
  },
};
