import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { wishlistApi } from '@/api/wishlist';
import { steamApi } from '@/api/steam';
import { queryKeys } from './queryKeys';

/** Matches the server-side cache TTL in api/wishlist.ts. */
const WISHLIST_STALE_MS = 10 * 60_000;

export function useWishlist() {
  return useQuery({
    queryKey: queryKeys.wishlist,
    queryFn: wishlistApi.list,
    staleTime: WISHLIST_STALE_MS,
    gcTime: 2 * 60 * 60_000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Forces a server-side rebuild of the wishlist. The response is written
 * straight into the query cache so every consumer updates at once, then the
 * key is invalidated so the normal query lifecycle takes over again.
 */
export function useRefreshWishlist() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: wishlistApi.refresh,
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.wishlist, data);
      qc.invalidateQueries({ queryKey: queryKeys.wishlist });
    },
  });
  return { refresh: mutation.mutate, pending: mutation.isPending };
}

export function useSteamConnection() {
  return useQuery({
    queryKey: queryKeys.steamConnection,
    queryFn: steamApi.getConnection,
    staleTime: 5 * 60_000,
  });
}
