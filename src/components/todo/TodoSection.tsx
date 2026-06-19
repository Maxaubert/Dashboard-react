import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Todo } from '@/api/types';
import { cn } from '@/lib/cn';
import { SortableTodoItem } from './TodoItem';

interface TodoSectionProps {
  id: 'active' | 'done';
  label: string;
  items: Todo[];
  emptyMessage: string;
  onEdit: (t: Todo) => void;
  onDelete: (id: string) => void;
  onToggleDone: (id: string) => void;
}

/**
 * Labeled list pane with start/end drop rails. Used by both the list view
 * (active + done sections) and the columns view's done section. The rails
 * give a target for "drop at very top/bottom" that doesn't depend on
 * hovering an existing item.
 */
export function TodoSection({
  id,
  label,
  items,
  emptyMessage,
  onEdit,
  onDelete,
  onToggleDone,
}: TodoSectionProps) {
  const { setNodeRef: containerRef, isOver } = useDroppable({ id });
  const { setNodeRef: startRailRef, isOver: isOverStart } = useDroppable({ id: `${id}-start` });
  const { setNodeRef: endRailRef, isOver: isOverEnd } = useDroppable({ id: `${id}-end` });
  return (
    <div>
      <div
        ref={startRailRef}
        className={cn('todo-section-label', 'todo-drop-rail', isOverStart && 'is-drop-target')}
      >
        {label}
      </div>
      <SortableContext items={items.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={containerRef}
          className={cn(
            'todo-list',
            `todo-list-${id}`,
            items.length === 0 && 'empty',
            (isOver || isOverStart || isOverEnd) && 'is-drop-target',
          )}
        >
          {items.length === 0 ? (
            <div className="todo-empty-state">{emptyMessage}</div>
          ) : (
            items.map((t) => (
              <SortableTodoItem
                key={t.id}
                todo={t}
                onEdit={() => onEdit(t)}
                onDelete={() => onDelete(t.id)}
                onToggleDone={() => onToggleDone(t.id)}
              />
            ))
          )}
        </div>
      </SortableContext>
      <div
        ref={endRailRef}
        className={cn('todo-drop-end-rail', isOverEnd && 'is-drop-target')}
        aria-hidden
      />
    </div>
  );
}
