import { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/ui';
import { useSaveTodos, useTodos } from '@/hooks/useTodos';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useWidgets } from '@/hooks/useWidgets';
import type { Priority, Todo } from '@/api/types';
import { cn } from '@/lib/cn';
import { playTodoCompleteSound } from '@/lib/sounds';
import { TodoListDnd } from '@/components/todo/TodoListDnd';
import { ColumnsDnd } from '@/components/todo/ColumnsDnd';
import { TodoModal } from '@/components/todo/TodoModal';

/**
 * Todo page — faithful port of todo.html.
 *
 * Two views: flat list and 3-column kanban (Høy/Medium/Lav). View
 * preference saved to localStorage. Drag-reorder within each list using
 * dnd-kit. Done section shown below both views (collapsed by default).
 *
 * Modal uses the compact Modal variant but renders its own button row
 * (right-aligned `Avbryt` + purple `Lagre`) inside `children` rather than
 * via the `footer` prop, since the legacy buttons aren't full-width.
 */
export function TodoPage() {
  const { data: todos } = useTodos();
  const saveTodos = useSaveTodos();
  const { toast } = useToast();
  const { addWidget, removeWidgetByRefId } = useWidgets();
  const [view, setView] = useLocalStorage<'list' | 'columns'>('todo-view', 'list');
  const [editing, setEditing] = useState<Todo | null>(null);
  const [creating, setCreating] = useState<Priority | null>(null);

  const sorted = useMemo(() => todos ?? [], [todos]);
  const active = sorted.filter((t) => !t.done);
  const done = sorted.filter((t) => t.done);

  function persist(next: Todo[]) {
    saveTodos.mutate(next, {
      onError: () => toast({ tone: 'danger', title: 'Klarte ikke å lagre' }),
    });
  }

  // Auto-purge: once per mount, drop any done todo whose completedAt is
  // older than 7 days. Runs only after the initial fetch lands and only
  // if there's actually something to purge — otherwise we'd cause a
  // redundant POST on every page visit.
  const purgedRef = useRef(false);
  useEffect(() => {
    if (purgedRef.current) return;
    if (!todos) return;
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const expired = todos.filter(
      (t) => t.done && t.completedAt && new Date(t.completedAt).getTime() < cutoff,
    );
    if (expired.length === 0) {
      purgedRef.current = true;
      return;
    }
    purgedRef.current = true;
    const kept = todos.filter((t) => !expired.some((e) => e.id === t.id));
    expired.forEach((t) => {
      if (t.pinned) removeWidgetByRefId(t.id);
    });
    persist(kept);
    // persist/removeWidgetByRefId and `todos` deps are intentionally
    // excluded — purgedRef guards against re-entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todos]);

  function handleSave(item: Todo) {
    const idx = sorted.findIndex((t) => t.id === item.id);
    const prev = idx >= 0 ? sorted[idx] : undefined;
    let next: Todo[];
    if (idx >= 0) {
      next = [...sorted];
      next[idx] = item;
    } else {
      next = [...sorted, item];
    }
    persist(next);

    const wasPinned = prev?.pinned ?? false;
    const isPinned = item.pinned ?? false;
    if (!wasPinned && isPinned) {
      addWidget('todo', item.id);
    } else if (wasPinned && !isPinned) {
      removeWidgetByRefId(item.id);
    }

    setEditing(null);
    setCreating(null);
  }

  function handleDelete(id: string) {
    const target = sorted.find((t) => t.id === id);
    persist(sorted.filter((t) => t.id !== id));
    if (target?.pinned) {
      removeWidgetByRefId(id);
    }
    setEditing(null);
  }

  function toggleDone(id: string) {
    const target = sorted.find((t) => t.id === id);
    // Only the direct checkbox click fires this; drag-to-complete goes
    // through persist() directly in the Dnd components, so sound fires
    // only for explicit checkbox clicks (and only on false → true).
    if (target && !target.done) playTodoCompleteSound();
    persist(sorted.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  function togglePin(id: string) {
    const target = sorted.find((t) => t.id === id);
    if (!target) return;
    const wasPinned = target.pinned ?? false;
    persist(sorted.map((t) => (t.id === id ? { ...t, pinned: !wasPinned } : t)));
    if (wasPinned) {
      removeWidgetByRefId(id);
    } else {
      addWidget('todo', id);
    }
  }

  return (
    <div className="todo-page">
      <div className="todo-hero">
        <div className="todo-hero-text">
          <div className="todo-eyebrow">Oppgaver</div>
          <h1 className="todo-title">Todo.</h1>
          <div className="todo-count">
            <strong>{active.length}</strong> aktive · {done.length} fullført
          </div>
        </div>
        <div className="todo-controls">
          <button
            className={cn('todo-chip', view === 'list' && 'active')}
            onClick={() => setView('list')}
          >
            Liste
          </button>
          <button
            className={cn('todo-chip', view === 'columns' && 'active')}
            onClick={() => setView('columns')}
          >
            Kolonner
          </button>
          <button className="todo-chip primary" onClick={() => setCreating('medium')}>
            ＋ Ny
          </button>
        </div>
      </div>

      {view === 'list' ? (
        <TodoListDnd
          active={active}
          done={done}
          onCommit={persist}
          onEdit={setEditing}
          onDelete={handleDelete}
          onToggleDone={toggleDone}
          onTogglePin={togglePin}
        />
      ) : (
        <ColumnsDnd
          active={active}
          done={done}
          onCommit={persist}
          onEdit={setEditing}
          onDelete={handleDelete}
          onToggleDone={toggleDone}
          onTogglePin={togglePin}
          onCreate={setCreating}
        />
      )}

      {(editing || creating) && (
        <TodoModal
          item={editing}
          defaultPriority={creating ?? 'medium'}
          onClose={() => {
            setEditing(null);
            setCreating(null);
          }}
          onSave={handleSave}
          onDelete={editing ? () => handleDelete(editing.id) : undefined}
        />
      )}
    </div>
  );
}
