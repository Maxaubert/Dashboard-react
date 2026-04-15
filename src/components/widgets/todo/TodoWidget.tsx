import { useEffect, useRef, useState } from 'react';
import { Pin, PinOff } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Modal } from '@/components/ui';
import { useSaveTodos, useTodos } from '@/hooks/useTodos';
import { useWidgets } from '@/hooks/useWidgets';
import { WidgetShell } from '../WidgetShell';
import { TodoModal, formatDeadline } from '@/pages/TodoPage';
import { playTodoCompleteSound } from '@/lib/sounds';
import type { Priority, Todo } from '@/api/types';

const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'Høy',
  medium: 'Medium',
  low: 'Lav',
};

interface TodoWidgetProps {
  refId: string;
}

/**
 * A2 — Per-todo pink-gradient tile rendered on the home page for each
 * pinned todo. Reads the referenced todo from `useTodos()`. If the todo
 * no longer exists (deleted), the widget self-removes via
 * `removeWidgetByRefId` in an effect, then renders null.
 *
 * Click the tile body  → opens a compact view popup with full text +
 *                         check / edit / delete buttons.
 * Click the check      → marks done; after 1s auto-unpins from home.
 * Right-click          → Edit / Unpin.
 */
export function TodoWidget({ refId }: TodoWidgetProps) {
  const { data: todos } = useTodos();
  const saveTodos = useSaveTodos();
  const { removeWidgetByRefId } = useWidgets();
  const [editing, setEditing] = useState(false);
  const [viewing, setViewing] = useState(false);
  // In-popup pin-intent state. Starts tracking the todo's actual pinned
  // value when the popup opens; toggling the corner pin icon flips this
  // locally (so the user can change their mind) and only commits on
  // popup close — avoids accidentally losing the widget on a misclick.
  const [viewPinnedIntent, setViewPinnedIntent] = useState(true);
  const autoUnpinRef = useRef<number | null>(null);

  const all: Todo[] = todos ?? [];
  const todo = all.find((t) => t.id === refId);

  useEffect(() => {
    if (todos && !todo) {
      removeWidgetByRefId(refId);
    }
  }, [todos, todo, refId, removeWidgetByRefId]);

  useEffect(() => () => {
    if (autoUnpinRef.current) window.clearTimeout(autoUnpinRef.current);
  }, []);

  if (!todo) return null;

  const deadlineInfo = todo.deadline ? formatDeadline(todo.deadline) : null;

  function persist(next: Todo[]) {
    saveTodos.mutate(next);
  }

  function markDoneAndSchedulePinRemoval() {
    if (!todo) return;
    playTodoCompleteSound();
    persist(all.map((t) => (t.id === todo.id ? { ...t, done: true } : t)));
    if (autoUnpinRef.current) window.clearTimeout(autoUnpinRef.current);
    autoUnpinRef.current = window.setTimeout(() => {
      // Use the latest list at the moment the timer fires so we don't
      // overwrite edits that happened in the meantime.
      const latest = (todos ?? []).map((t) =>
        t.id === refId ? { ...t, done: true, pinned: false } : t
      );
      persist(latest);
      removeWidgetByRefId(refId);
    }, 1000);
  }

  function handleToggleDone(e: React.MouseEvent) {
    e.stopPropagation();
    if (!todo) return;
    if (todo.done) {
      // Unchecking: just flip done, keep pinned, cancel pending removal.
      if (autoUnpinRef.current) window.clearTimeout(autoUnpinRef.current);
      autoUnpinRef.current = null;
      persist(all.map((t) => (t.id === todo.id ? { ...t, done: false } : t)));
    } else {
      markDoneAndSchedulePinRemoval();
    }
  }

  function handleUnpin() {
    if (!todo) return;
    persist(all.map((t) => (t.id === todo.id ? { ...t, pinned: false } : t)));
    removeWidgetByRefId(refId);
  }

  /**
   * Close the view popup. Commits the user's pin-intent only at this
   * moment — so an accidental click on the corner icon can be undone
   * by clicking it again before dismissing the popup.
   */
  function closeView() {
    if (!viewPinnedIntent && todo?.pinned) {
      handleUnpin();
    }
    setViewing(false);
  }

  function openView() {
    setViewPinnedIntent(true);
    setViewing(true);
  }

  function handleDelete() {
    if (!todo) return;
    persist(all.filter((t) => t.id !== todo.id));
    removeWidgetByRefId(refId);
    setViewing(false);
  }

  function handleSave(item: Todo) {
    const idx = all.findIndex((t) => t.id === item.id);
    let next: Todo[];
    if (idx >= 0) {
      next = [...all];
      next[idx] = item;
    } else {
      next = [...all, item];
    }
    persist(next);
    if (!item.pinned) removeWidgetByRefId(refId);
    setEditing(false);
  }

  return (
    <>
      <WidgetShell
        className={cn('todo-widget', todo.done && 'done')}
        onClick={openView}
        ariaLabel={`Åpne ${todo.text}`}
        menu={[
          { label: 'Edit', onSelect: () => setEditing(true) },
          { label: 'Unpin', onSelect: handleUnpin, destructive: true },
        ]}
      >
        <div className="todo-widget-header">
          <span>📌 Festet</span>
        </div>
        <span
          role="button"
          tabIndex={0}
          className="todo-widget-check"
          onClick={handleToggleDone}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              handleToggleDone(e as unknown as React.MouseEvent);
            }
          }}
          aria-label={todo.done ? 'Marker som ufullført' : 'Marker som ferdig'}
        >
          {todo.done && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </span>
        <div className="todo-widget-title">{todo.text}</div>
        <div className="todo-widget-pills">
          <span className="todo-widget-pill">{PRIORITY_LABEL[todo.priority]}</span>
          {deadlineInfo && (
            <span className={cn('todo-widget-pill', deadlineInfo.overdue && 'overdue')}>
              {deadlineInfo.label}
            </span>
          )}
        </div>
      </WidgetShell>

      {viewing && (
        <Modal
          open
          onOpenChange={(o) => !o && closeView()}
          title="📌 Festet oppgave"
          size="md"
          variant="standard"
          footer={
            <>
              <button
                className={cn('todo-view-btn', todo.done ? 'undo' : 'primary')}
                onClick={(e) => {
                  handleToggleDone(e);
                  closeView();
                }}
              >
                {todo.done ? '↺ Angre ferdig' : '✓ Merk ferdig'}
              </button>
              <button
                className="todo-view-btn ghost"
                onClick={() => {
                  closeView();
                  setEditing(true);
                }}
              >
                ✎ Rediger
              </button>
              <button className="todo-view-btn delete" onClick={handleDelete}>
                🗑 Slett
              </button>
            </>
          }
        >
          <div className="todo-view">
            <button
              type="button"
              className={cn('todo-view-pin', !viewPinnedIntent && 'unpinned')}
              onClick={() => setViewPinnedIntent((v) => !v)}
              aria-label={viewPinnedIntent ? 'Løsne fra dashboard' : 'Fest til dashboard'}
              title={
                viewPinnedIntent
                  ? 'Løsne fra dashboard (tar effekt når du lukker)'
                  : 'Fest til dashboard'
              }
            >
              {viewPinnedIntent ? <PinOff size={16} /> : <Pin size={16} />}
            </button>
            <div className="todo-view-text">{todo.text}</div>
            <div className="todo-view-meta">
              <span className={cn('todo-view-badge', `pri-${todo.priority}`)}>
                {PRIORITY_LABEL[todo.priority]}
              </span>
              {deadlineInfo && (
                <span className={cn('todo-view-deadline', deadlineInfo.overdue && 'overdue')}>
                  {deadlineInfo.label}
                </span>
              )}
              {todo.done && <span className="todo-view-done">Fullført</span>}
            </div>
          </div>
        </Modal>
      )}

      {editing && (
        <TodoModal
          item={todo}
          defaultPriority={todo.priority}
          onClose={() => setEditing(false)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </>
  );
}
