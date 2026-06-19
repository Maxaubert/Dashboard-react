import { useQuery } from '@tanstack/react-query';
import { wishlistApi } from '@/api/wishlist';
import { steamApi } from '@/api/steam';
import { queryKeys } from './queryKeys';

export function useWishlist() {
  return useQuery({
    queryKey: queryKeys.wishlist,
    queryFn: wishlistApi.list,
    /** Backend caches for 1 hour. */
    staleTime: 60 * 60_000,
    gcTime: 2 * 60 * 60_000,
  });
}

export function useSteamConnection() {
  return useQuery({
    queryKey: ['steam-connection'],
    queryFn: steamApi.getConnection,
    staleTime: 5 * 60_000,
  });
}
