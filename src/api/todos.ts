import { api } from './client';
import type { Todo } from './types';

export const todosApi = {
  list: () => api.get<Todo[]>('/todos'),
  /** The legacy backend takes the entire list in one POST. */
  saveAll: (todos: Todo[]) => api.post<{ ok: boolean }>('/todos', todos),
};
