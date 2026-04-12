import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notesApi } from '@/api/notes';
import type { Note } from '@/api/types';
import { queryKeys } from './queryKeys';

export function useNotes() {
  return useQuery({
    queryKey: queryKeys.notes,
    queryFn: notesApi.list,
    staleTime: 30_000,
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note: Omit<Note, 'id'>) => notesApi.create(note),
    onSuccess: (created) => {
      qc.setQueryData<Note[]>(queryKeys.notes, (prev) =>
        prev ? [created, ...prev] : [created]
      );
    },
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Note> }) =>
      notesApi.update(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: queryKeys.notes });
      const previous = qc.getQueryData<Note[]>(queryKeys.notes);
      qc.setQueryData<Note[]>(queryKeys.notes, (prev) =>
        prev?.map((n) => (n.id === id ? { ...n, ...patch } : n))
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.notes, ctx.previous);
    },
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notesApi.delete(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.notes });
      const previous = qc.getQueryData<Note[]>(queryKeys.notes);
      qc.setQueryData<Note[]>(queryKeys.notes, (prev) => prev?.filter((n) => n.id !== id));
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.notes, ctx.previous);
    },
  });
}
