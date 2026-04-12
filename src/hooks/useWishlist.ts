import { useQuery } from '@tanstack/react-query';
import { wishlistApi } from '@/api/wishlist';
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
