import { useMemo } from 'react';
import { useTodos } from '@/hooks/useTodos';
import { usePageOverlay } from '@/context/PageOverlayContext';
import { topOpenTodos } from '@/lib/todoPreview';
import type { Todo } from '@/api/types';

/** Todo (sage highlight card) — completion meter + a short preview list. */
export function TodoBentoCard() {
  const { data: todos } = useTodos();
  const { openOverlay } = usePageOverlay();
  const list = todos ?? [];

  const total = list.length;
  const done = list.filter((t) => t.done).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Show open todos first (highest priority), then a couple of recently
  // done ones so the checkmark style appears when there's progress.
  const preview = useMemo<Todo[]>(() => {
    const open = topOpenTodos(list, 4);
    if (open.length >= 4) return open;
    const completed = list.filter((t) => t.done).slice(0, 4 - open.length);
    return [...open, ...completed];
  }, [list]);

  return (
    <section className="bento-card sage area-todo">
      <div className="ch">
        <h2>Todo</h2>
        <button type="button" className="ch-link" onClick={() => openOverlay('todo')}>
          Vis alle
        </button>
      </div>
      <div className="tohead">
        <span className="big">{pct}%</span>
        <span className="lab">
          {done} av {total} fullført
        </span>
      </div>
      <div className="tolist">
        {preview.length === 0 ? (
          <div className="todo-empty">Ingen gjøremål enda.</div>
        ) : (
          preview.map((todo) => (
            <button
              key={todo.id}
              type="button"
              className={`torow${todo.done ? ' done' : ''}`}
              onClick={() => openOverlay('todo')}
            >
              <span className="tobox" />
              <span className={`pdotS prio-${todo.priority}`} />
              <span className="tt">{todo.text}</span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
