import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { linksApi } from '@/api/links';
import type { LinksEnvelope } from '@/api/types';
import { queryKeys } from './queryKeys';

/**
 * Fetches the full links library as a v2 envelope: { version, links, categories }.
 * Consumers that only need the flat link array can do `const { data } = useLinks(); const links = data?.links ?? [];`.
 */
export function useLinks() {
  return useQuery({
    queryKey: queryKeys.links,
    queryFn: linksApi.list,
    staleTime: 60_000,
  });
}

/**
 * Saves the entire envelope. Callers construct the full next envelope and call
 * `.mutate(envelope)`. Optimistic update swaps in the next envelope immediately
 * and rolls back on error.
 */
export function useSaveLinks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (envelope: LinksEnvelope) => linksApi.saveAll(envelope),
    onMutate: async (next) => {
      const previous = qc.getQueryData<LinksEnvelope>(queryKeys.links);
      qc.setQueryData(queryKeys.links, next);
      await qc.cancelQueries({ queryKey: queryKeys.links });
      return { previous };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.links, ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.links });
    },
  });
}
