import { useMemo, useState } from 'react';
import { Modal, useToast } from '@/components/ui';
import { SortableList } from '@/components/patterns';
import { useSaveTodos, useTodos } from '@/hooks/useTodos';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { Priority, Todo } from '@/api/types';
import { cn } from '@/lib/cn';

const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'Høy',
  medium: 'Medium',
  low: 'Lav',
};
const COLUMN_ORDER: Priority[] = ['high', 'medium', 'low'];

/**
 * Todo page — faithful port of todo.html.
 *
 * Two views: flat list and 3-column kanban (Høy/Medium/Lav). View
 * preference saved to localStorage. Drag-reorder within each list using
 * dnd-kit. Done section shown below both views (collapsed by default).
 *
 * Modal uses my Modal compact variant but renders its own button row
 * (right-aligned `Avbryt` + purple `Lagre`) inside `children` rather than
 * via the `footer` prop, since the legacy buttons aren't full-width.
 */
export function TodoPage() {
  const { data: todos } = useTodos();
  const saveTodos = useSaveTodos();
  const { toast } = useToast();
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

  function handleSave(item: Todo) {
    const idx = sorted.findIndex((t) => t.id === item.id);
    let next: Todo[];
    if (idx >= 0) {
      next = [...sorted];
      next[idx] = item;
    } else {
      next = [...sorted, item];
    }
    persist(next);
    setEditing(null);
    setCreating(null);
  }

  function handleDelete(id: string) {
    persist(sorted.filter((t) => t.id !== id));
    setEditing(null);
  }

  function toggleDone(id: string) {
    persist(sorted.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  function reorderList(items: Todo[]) {
    persist([...items, ...done]);
  }

  function reorderColumn(priority: Priority, items: Todo[]) {
    const others = sorted.filter((t) => t.priority !== priority || t.done);
    persist([...others, ...items]);
  }

  return (
    <div className="todo-page">
      <div className="todo-title-desktop">
        <span className="todo-title-main">Todo</span>
        <div className="todo-header-actions">
          <div className="view-switch">
            <button
              className={cn('view-switch-btn', view === 'list' && 'active')}
              onClick={() => setView('list')}
              title="Listevisning"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
              </svg>
            </button>
            <button
              className={cn('view-switch-btn', view === 'columns' && 'active')}
              onClick={() => setView('columns')}
              title="Kolonnevisning"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 5v14h18V5H3zm6 12H5v-4h4v4zm0-6H5V7h4v4zm6 6h-4v-4h4v4zm0-6h-4V7h4v4zm6 6h-4v-4h4v4zm0-6h-4V7h4v4z" />
              </svg>
            </button>
          </div>
          <button className="btn-new-task" onClick={() => setCreating('medium')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z" />
            </svg>
            Legg til oppgave
          </button>
        </div>
      </div>

      {view === 'list' ? (
        <div>
          <div className="todo-section-label">Aktive</div>
          {active.length === 0 ? (
            <div className="todo-empty-state">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
              Ingen oppgaver ennå.
              <br />
              Klikk «Legg til oppgave» for å starte.
            </div>
          ) : (
            <SortableList
              items={active}
              onReorder={reorderList}
              renderItem={(t) => (
                <TodoItem
                  todo={t}
                  onEdit={() => setEditing(t)}
                  onDelete={() => handleDelete(t.id)}
                  onToggleDone={() => toggleDone(t.id)}
                />
              )}
              className="todo-list"
            />
          )}
        </div>
      ) : (
        <div className="columns-grid">
          {COLUMN_ORDER.map((priority) => {
            const items = active.filter((t) => t.priority === priority);
            return (
              <div key={priority} className={cn('priority-col', priority)}>
                <div className="col-header">
                  <span className="col-dot" />
                  <span className="col-label">{PRIORITY_LABEL[priority]}</span>
                  <button
                    className="col-add-btn"
                    onClick={() => setCreating(priority)}
                    title={`Legg til ${PRIORITY_LABEL[priority].toLowerCase()}-prioritet oppgave`}
                  >
                    +
                  </button>
                </div>
                <SortableList
                  items={items}
                  onReorder={(next) => reorderColumn(priority, next)}
                  renderItem={(t) => (
                    <TodoItem
                      todo={t}
                      onEdit={() => setEditing(t)}
                      onDelete={() => handleDelete(t.id)}
                      onToggleDone={() => toggleDone(t.id)}
                    />
                  )}
                  className="col-list"
                />
              </div>
            );
          })}
        </div>
      )}

      {done.length > 0 && (
        <div>
          <div className="todo-section-label">Fullført</div>
          <div className="todo-list">
            {done.map((t) => (
              <TodoItem
                key={t.id}
                todo={t}
                onEdit={() => setEditing(t)}
                onDelete={() => handleDelete(t.id)}
                onToggleDone={() => toggleDone(t.id)}
              />
            ))}
          </div>
        </div>
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

/* ── Todo item card ──────────────────────────────────────────────────────── */
interface TodoItemProps {
  todo: Todo;
  onEdit: () => void;
  onDelete: () => void;
  onToggleDone: () => void;
}

function TodoItem({ todo, onEdit, onDelete, onToggleDone }: TodoItemProps) {
  const deadlineInfo = todo.deadline ? formatDeadline(todo.deadline) : null;

  return (
    <div className={cn('todo-item', `priority-${todo.priority}`, todo.done && 'done')}>
      <button
        className="todo-check"
        onClick={(e) => {
          e.stopPropagation();
          onToggleDone();
        }}
        aria-label={todo.done ? 'Marker som ufullført' : 'Marker som ferdig'}
      >
        {todo.done && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      <div className="todo-body">
        <div className="todo-title">{todo.text}</div>
        <div className="todo-meta">
          <span className={cn('todo-badge', todo.priority)}>{PRIORITY_LABEL[todo.priority]}</span>
          {deadlineInfo && (
            <span className={cn('todo-deadline', deadlineInfo.overdue && 'overdue')}>
              {deadlineInfo.label}
            </span>
          )}
        </div>
      </div>

      <div className="todo-actions">
        <button
          className="edit"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          aria-label="Rediger"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </button>
        <button
          className="delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="Slett"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function formatDeadline(iso: string): { label: string; overdue: boolean } {
  const due = new Date(iso);
  const now = new Date();
  const diffDays = Math.round((due.getTime() - now.getTime()) / 86_400_000);
  const overdue = diffDays < 0;
  let label: string;
  if (diffDays === 0) label = 'I dag';
  else if (diffDays === 1) label = 'I morgen';
  else if (diffDays === -1) label = 'I går';
  else if (diffDays < 0) label = `${Math.abs(diffDays)} dager forsinket`;
  else if (diffDays < 7) label = `Om ${diffDays} dager`;
  else label = due.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
  return { label, overdue };
}

/* ── Edit modal ──────────────────────────────────────────────────────────── */
interface TodoModalProps {
  item: Todo | null;
  defaultPriority: Priority;
  onClose: () => void;
  onSave: (item: Todo) => void;
  onDelete?: () => void;
}

function TodoModal({ item, defaultPriority, onClose, onSave, onDelete }: TodoModalProps) {
  const [form, setForm] = useState<Todo>(
    item ?? {
      id: String(Date.now()),
      text: '',
      priority: defaultPriority,
      deadline: null,
      done: false,
    }
  );

  function update<K extends keyof Todo>(key: K, value: Todo[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    if (!form.text.trim()) return;
    onSave(form);
  }

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={item ? 'Rediger oppgave' : 'Ny oppgave'}
      size="lg"
    >
      <div className="todo-modal-fields">
        <div className="todo-field">
          <label htmlFor="t-title">Tittel</label>
          <input
            id="t-title"
            type="text"
            placeholder="Hva skal gjøres?"
            autoComplete="off"
            autoFocus
            value={form.text}
            onChange={(e) => update('text', e.target.value)}
          />
        </div>

        <div className="todo-field">
          <label>Prioritet</label>
          <div className="priority-row">
            <button
              type="button"
              className={cn('pri-btn', form.priority === 'low' && 'selected')}
              data-p="low"
              onClick={() => update('priority', 'low')}
            >
              Lav
            </button>
            <button
              type="button"
              className={cn('pri-btn', form.priority === 'medium' && 'selected')}
              data-p="medium"
              onClick={() => update('priority', 'medium')}
            >
              Medium
            </button>
            <button
              type="button"
              className={cn('pri-btn', form.priority === 'high' && 'selected')}
              data-p="high"
              onClick={() => update('priority', 'high')}
            >
              Høy
            </button>
          </div>
        </div>

        <div className="todo-field">
          <label htmlFor="t-deadline">Frist</label>
          <input
            id="t-deadline"
            type="date"
            value={form.deadline ?? ''}
            onChange={(e) => update('deadline', e.target.value || null)}
          />
        </div>

        <div className="todo-modal-actions">
          {onDelete && (
            <button className="btn-delete-todo" onClick={onDelete}>
              Slett
            </button>
          )}
          <button className="btn-cancel-todo" onClick={onClose}>
            Avbryt
          </button>
          <button className="btn-save-todo" onClick={handleSubmit}>
            Lagre
          </button>
        </div>
      </div>
    </Modal>
  );
}
