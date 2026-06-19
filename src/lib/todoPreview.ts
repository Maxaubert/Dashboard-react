import type { Todo } from '@/api/types';

const RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

/** Top open (not done) todos, highest priority first, capped at n. */
export function topOpenTodos(todos: Todo[], n = 5): Todo[] {
  return todos
    .filter((todo) => !todo.done)
    .sort((a, b) => (RANK[a.priority] ?? 9) - (RANK[b.priority] ?? 9))
    .slice(0, n);
}
