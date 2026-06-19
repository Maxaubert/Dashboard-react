import { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Todo } from '@/api/types';
import { cn } from '@/lib/cn';
import { formatDeadline } from '@/lib/todo';

export interface TodoItemProps {
  todo: Todo;
  onEdit: () => void;
  onDelete: () => void;
  onToggleDone: () => void;
}

function TodoItemImpl({ todo, onEdit, onDelete, onToggleDone }: TodoItemProps) {
  const deadlineInfo = todo.deadline ? formatDeadline(todo.deadline) : null;

  return (
    <div
      className={cn(
        'todo-item',
        `priority-${todo.priority}`,
        todo.done && 'done',
      )}
    >
      <button
        className="todo-check"
        onClick={(e) => {
          e.stopPropagation();
          onToggleDone();
        }}
        aria-label={todo.done ? 'Marker som ufullført' : 'Marker som ferdig'}
      >
        {todo.done && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      <span className="todo-pri-dot" aria-hidden />

      <div className="todo-title-text">{todo.text}</div>

      {deadlineInfo && (
        <span className={cn('todo-deadline', deadlineInfo.overdue && 'overdue')}>
          {deadlineInfo.label}
        </span>
      )}

      <div className="todo-actions">
        <button
          className="todo-action-btn edit"
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
          className="todo-action-btn delete"
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

/**
 * Memoized so drag-induced parent re-renders (every dnd-kit tick mirrors
 * to local state in TodoListDnd / ColumnsDnd) don't cascade through every
 * row. Handler props are intentionally ignored in the comparator: callers
 * pass inline arrows that close over (id) and are equivalent for the same
 * id — old and new handlers do the same thing.
 */
export const TodoItem = memo(TodoItemImpl, (prev, next) => {
  const a = prev.todo;
  const b = next.todo;
  return (
    a.id === b.id &&
    a.text === b.text &&
    a.priority === b.priority &&
    a.done === b.done &&
    (a.deadline ?? null) === (b.deadline ?? null)
  );
});

/** Sortable wrapper used inside SortableContext. The DragOverlay copy
 *  uses TodoItem directly so the floating row isn't draggable itself. */
export function SortableTodoItem(props: TodoItemProps) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: props.todo.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TodoItem {...props} />
    </div>
  );
}
