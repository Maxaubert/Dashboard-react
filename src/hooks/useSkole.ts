import { useQuery } from '@tanstack/react-query';
import { skoleApi } from '@/api/skole';
import { queryKeys } from './queryKeys';

export function useSkole() {
  return useQuery({
    queryKey: queryKeys.skole,
    queryFn: skoleApi.get,
    /** Backend caches for 30 minutes; mirror that on the client. */
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  });
}
