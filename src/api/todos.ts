import { readDoc, writeDoc } from '@/lib/docStore';
import type { Todo } from './types';

export const todosApi = {
  list: () => readDoc<Todo[]>('todos', []),
  saveAll: async (todos: Todo[]) => {
    await writeDoc('todos', todos);
    return { ok: true };
  },
};
