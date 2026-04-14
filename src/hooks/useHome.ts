import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { homeApi } from '@/api/home';
import type { HomeEnvelope } from '@/api/types';
import { queryKeys } from './queryKeys';

const EMPTY_HOME: HomeEnvelope = { version: 1, sections: [], widgets: [], habits: [] };

/**
 * Fetches the single home-page envelope: { version, sections, widgets, habits }.
 * Passes through `normaliseHome` so consumers never see missing arrays even if
 * the backend returns a partial payload.
 */
export function useHome() {
  return useQuery({
    queryKey: queryKeys.home,
    queryFn: async () => {
      const raw = await homeApi.list();
      return normaliseHome(raw);
    },
    staleTime: 60_000,
  });
}

/**
 * Saves the full envelope. Callers construct the next envelope and call
 * `.mutate(next)`. Optimistic update swaps it in immediately; rolls back
 * on error. Mirrors the useSaveLinks pattern.
 */
export function useSaveHome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (envelope: HomeEnvelope) => homeApi.saveAll(envelope),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: queryKeys.home });
      const previous = qc.getQueryData<HomeEnvelope>(queryKeys.home);
      qc.setQueryData(queryKeys.home, next);
      return { previous };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.home, ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.home });
    },
  });
}

/**
 * Apply a patch function to the LATEST cached envelope. Avoids the stale-closure
 * bug where two rapid `save.mutate(...)` calls — e.g. `addHabit` immediately
 * followed by `addWidget` from `handleAddHabit` — each read a pre-mutation
 * `data` reference and clobber the other's update.
 *
 * Usage:
 *   const mutate = useMutateHome();
 *   mutate((prev) => ({ ...prev, widgets: [...prev.widgets, newWidget] }));
 */
export function useMutateHome() {
  const qc = useQueryClient();
  const save = useSaveHome();
  return useCallback(
    (patch: (prev: HomeEnvelope) => HomeEnvelope) => {
      const prev = qc.getQueryData<HomeEnvelope>(queryKeys.home) ?? EMPTY_HOME;
      const next = patch(prev);
      // If the patch was a no-op (dedupe / empty delta), skip the network round-trip.
      if (next === prev) return;
      save.mutate(next);
    },
    [qc, save],
  );
}

export function normaliseHome(raw: Partial<HomeEnvelope> | null | undefined): HomeEnvelope {
  return {
    version: 1,
    sections: Array.isArray(raw?.sections) ? raw!.sections : [],
    widgets: Array.isArray(raw?.widgets) ? raw!.widgets : [],
    habits: Array.isArray(raw?.habits) ? raw!.habits : [],
  };
}
