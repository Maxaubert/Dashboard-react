import { api } from './client';
import type { WishlistGame } from './types';

export const wishlistApi = {
  /** GET /api/wishlist — server caches Steam + ITAD data for 1 hour. */
  list: () => api.get<WishlistGame[]>('/wishlist', { timeoutMs: 20000 }),
};
