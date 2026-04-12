import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { todosApi } from '@/api/todos';
import type { Todo } from '@/api/types';
import { queryKeys } from './queryKeys';

export function useTodos() {
  return useQuery({
    queryKey: queryKeys.todos,
    queryFn: todosApi.list,
    staleTime: 30_000,
  });
}

/**
 * Saves the entire todo list. Uses optimistic updates so the UI flips
 * immediately and rolls back on failure. The legacy backend doesn't have
 * per-item PATCH/DELETE, so the only mutation primitive is "replace all".
 */
export function useSaveTodos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (todos: Todo[]) => todosApi.saveAll(todos),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: queryKeys.todos });
      const previous = qc.getQueryData<Todo[]>(queryKeys.todos);
      qc.setQueryData(queryKeys.todos, next);
      return { previous };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.todos, ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.todos });
    },
  });
}
