import type { QueryClient, UseMutationOptions } from '@tanstack/react-query';

type BulkSaveContext<T> = { previous: T | undefined };

/**
 * Mutation options shared by the bulk-replace document stores (todos, plan,
 * home). The backend has no per-item PATCH, so every save re-uploads the
 * whole document and two overlapping saves can race. Three rules keep them
 * honest:
 *
 * 1. `scope` serialises the network calls per document, so an earlier save
 *    can never commit after a later one.
 * 2. The optimistic cache write happens synchronously, before any await, so a
 *    second `mutate()` call that reads the cache right after the first sees
 *    the first one's changes instead of clobbering them.
 * 3. `onSettled` only invalidates when this is the last pending save in the
 *    scope. Refetching after an earlier save while a later one is still queued
 *    would briefly revert the later change on screen.
 */
export function bulkSaveMutation<T>(
  qc: QueryClient,
  queryKey: readonly unknown[],
  save: (next: T) => Promise<unknown>,
  prepare: (raw: T) => T = (raw) => raw,
): UseMutationOptions<unknown, Error, T, BulkSaveContext<T>> {
  const mutationKey = queryKey;
  return {
    mutationKey,
    scope: { id: mutationKey.join(':') },
    mutationFn: (raw) => save(prepare(raw)),
    onMutate: (raw) => {
      const previous = qc.getQueryData<T>(queryKey);
      qc.setQueryData(queryKey, prepare(raw));
      qc.cancelQueries({ queryKey }).catch(() => {});
      return { previous };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKey, ctx.previous);
    },
    onSettled: () => {
      if (qc.isMutating({ mutationKey }) <= 1) {
        qc.invalidateQueries({ queryKey });
      }
    },
  };
}
