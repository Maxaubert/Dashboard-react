import { supabase } from '@/lib/supabase';
import type { WishlistGame } from './types';

export interface WishlistResponse {
  connected: boolean;
  games: WishlistGame[];
}

async function request(path: string): Promise<WishlistResponse> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? '';
  const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`wishlist ${res.status}`);
  return res.json();
}

export const wishlistApi = {
  list: (): Promise<WishlistResponse> => request('/api/wishlist'),
  /**
   * Rebuilds the list server-side, skipping the cached row. The server still
   * returns the cached row when it is younger than 60 s (rate limit).
   */
  refresh: (): Promise<WishlistResponse> => request('/api/wishlist?refresh=1'),
};
