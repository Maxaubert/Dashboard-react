import { supabase } from '@/lib/supabase';
import type { WishlistGame } from './types';

export interface WishlistResponse {
  connected: boolean;
  games: WishlistGame[];
}

export const wishlistApi = {
  list: async (): Promise<WishlistResponse> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? '';
    const res = await fetch('/api/wishlist', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`wishlist ${res.status}`);
    return res.json();
  },
};
