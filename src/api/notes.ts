import { api } from './client';
import type { Note } from './types';

/**
 * Notes are served by the Flask sidecar (server/notes_api.py), but the
 * routes share the /api/* prefix and nginx sends them to the right port.
 * From the React app's perspective there is no difference.
 */
export const notesApi = {
  list: () => api.get<Note[]>('/notes'),
  create: (note: Omit<Note, 'id'>) => api.post<Note>('/notes', note),
  update: (id: string, patch: Partial<Note>) => api.put<Note>(`/notes/${id}`, patch),
  delete: (id: string) => api.del<{ ok: boolean }>(`/notes/${id}`),
};
