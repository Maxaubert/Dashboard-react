import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { planApi } from '@/api/plan';
import type { PlanItem } from '@/api/types';
import { bulkSaveMutation } from './bulkSaveMutation';
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
  return useMutation(bulkSaveMutation<PlanItem[]>(qc, queryKeys.plan, planApi.saveAll));
}
