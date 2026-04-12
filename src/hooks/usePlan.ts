import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { planApi } from '@/api/plan';
import type { PlanItem } from '@/api/types';
import { queryKeys } from './queryKeys';

export function usePlan() {
  return useQuery({
    queryKey: queryKeys.plan,
    queryFn: planApi.list,
    staleTime: 60_000,
  });
}

export function useSavePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: PlanItem[]) => planApi.saveAll(items),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: queryKeys.plan });
      const previous = qc.getQueryData<PlanItem[]>(queryKeys.plan);
      qc.setQueryData(queryKeys.plan, next);
      return { previous };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.plan, ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.plan });
    },
  });
}
