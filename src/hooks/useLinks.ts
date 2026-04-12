import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { linksApi } from '@/api/links';
import type { LinkItem } from '@/api/types';
import { queryKeys } from './queryKeys';

export function useLinks() {
  return useQuery({
    queryKey: queryKeys.links,
    queryFn: linksApi.list,
    staleTime: 60_000,
  });
}

export function useSaveLinks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (links: LinkItem[]) => linksApi.saveAll(links),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: queryKeys.links });
      const previous = qc.getQueryData<LinkItem[]>(queryKeys.links);
      qc.setQueryData(queryKeys.links, next);
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
