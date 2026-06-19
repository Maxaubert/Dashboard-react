import { describe, it, expect } from 'vitest';
import { topOpenTodos } from './todoPreview';
import type { Todo } from '@/api/types';

const t = (p: Partial<Todo> & { id: string }): Todo => ({
  id: p.id, text: p.text ?? p.id, priority: p.priority ?? 'medium',
  done: p.done ?? false, deadline: p.deadline ?? null,
});

describe('topOpenTodos', () => {
  it('drops done todos and orders by priority (high->low)', () => {
    const out = topOpenTodos([
      t({ id: 'a', priority: 'low' }),
      t({ id: 'b', priority: 'high' }),
      t({ id: 'c', priority: 'medium', done: true }),
      t({ id: 'd', priority: 'medium' }),
    ]);
    expect(out.map((x) => x.id)).toEqual(['b', 'd', 'a']);
  });
  it('caps the list at n', () => {
    const many = Array.from({ length: 8 }, (_, i) => t({ id: String(i) }));
    expect(topOpenTodos(many, 5)).toHaveLength(5);
  });
});
