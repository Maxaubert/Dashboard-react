import { useMemo } from 'react';
import { DndContext, DragOverlay, useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { Priority, Todo } from '@/api/types';
import { cn } from '@/lib/cn';
import { PRIORITY_LABEL } from '@/lib/todo';
import { useMultiContainerDnd } from '@/hooks/useMultiContainerDnd';
import { TodoItem, SortableTodoItem } from './TodoItem';
import { TodoSection } from './TodoSection';

type ColumnId = Priority | 'done';
const COLUMN_IDS = ['high', 'medium', 'low', 'done'] as const;

interface ColumnsDndProps {
  active: Todo[];
  done: Todo[];
  onCommit: (flat: Todo[]) => void;
  onEdit: (t: Todo) => void;
  onDelete: (id: string) => void;
  onToggleDone: (id: string) => void;
  onCreate: (priority: Priority) => void;
}

/**
 * Four-column kanban: Høy / Medium / Lav / Fullført. Dragging between
 * priority columns mutates the todo's priority; dragging into Fullført
 * flips `done` while keeping the existing priority (so unchecking later
 * puts the todo back where it came from).
 */
export function ColumnsDnd({
  active,
  done,
  onCommit,
  onEdit,
  onDelete,
  onToggleDone,
  onCreate,
}: ColumnsDndProps) {
  const containers = useMemo<Record<ColumnId, Todo[]>>(
    () => ({
      high: active.filter((t) => t.priority === 'high'),
      medium: active.filter((t) => t.priority === 'medium'),
      low: active.filter((t) => t.priority === 'low'),
      done,
    }),
    [active, done],
  );

  const dnd = useMultiContainerDnd<Todo, ColumnId>({
    containers,
    containerIds: COLUMN_IDS,
    itemId: (t) => t.id,
    onCommit,
    // Priority columns set the priority and clear done; done column sets
    // done and keeps the priority so unchecking later restores the column.
    transformOnMove: (item, _from, to) => ({
      ...item,
      priority: to === 'done' ? item.priority : to,
      done: to === 'done',
    }),
    fingerprint: (t) =>
      `${t.id}:${t.priority}:${t.done ? 1 : 0}:${t.text}:${t.deadline ?? ''}`,
  });

  return (
    <DndContext
      sensors={dnd.sensors}
      collisionDetection={dnd.collisionDetection}
      onDragStart={dnd.onDragStart}
      onDragOver={dnd.onDragOver}
      onDragEnd={dnd.onDragEnd}
      onDragCancel={dnd.onDragCancel}
    >
      <div className="columns-grid">
        {(['high', 'medium', 'low'] as Priority[]).map((p) => (
          <ColumnDropZone
            key={p}
            id={p}
            items={dnd.local[p]}
            priority={p}
            onCreate={() => onCreate(p)}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleDone={onToggleDone}
          />
        ))}
      </div>
      <TodoSection
        id="done"
        label="Fullført"
        items={dnd.local.done}
        emptyMessage="Dra oppgaver hit for å markere som ferdig."
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleDone={onToggleDone}
      />
      <DragOverlay>
        {dnd.activeItem ? (
          <TodoItem
            todo={dnd.activeItem}
            onEdit={() => {}}
            onDelete={() => {}}
            onToggleDone={() => {}}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

interface ColumnDropZoneProps {
  id: Priority;
  priority: Priority;
  items: Todo[];
  onCreate: () => void;
  onEdit: (t: Todo) => void;
  onDelete: (id: string) => void;
  onToggleDone: (id: string) => void;
}

function ColumnDropZone({
  id,
  priority,
  items,
  onCreate,
  onEdit,
  onDelete,
  onToggleDone,
}: ColumnDropZoneProps) {
  const { setNodeRef: containerRef, isOver } = useDroppable({ id });
  const { setNodeRef: startRailRef, isOver: isOverStart } = useDroppable({ id: `${id}-start` });
  const { setNodeRef: endRailRef, isOver: isOverEnd } = useDroppable({ id: `${id}-end` });
  return (
    <div className={cn('priority-col', priority)}>
      <div
        ref={startRailRef}
        className={cn('col-header', 'todo-drop-rail', isOverStart && 'is-drop-target')}
      >
        <span className="col-dot" />
        <span className="col-label">{PRIORITY_LABEL[priority]}</span>
        <span className="col-count">{items.length}</span>
        <button
          className="col-add-btn"
          onClick={onCreate}
          title={`Legg til ${PRIORITY_LABEL[priority].toLowerCase()}-prioritet oppgave`}
        >
          +
        </button>
      </div>
      <SortableContext items={items.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={containerRef}
          className={cn(
            'col-list',
            'todo-list',
            items.length === 0 && 'empty',
            (isOver || isOverStart || isOverEnd) && 'is-drop-target',
          )}
        >
          {items.length === 0 ? (
            <div className="todo-empty-state" style={{ padding: '14px 8px', fontSize: '0.72rem' }}>
              Dra hit eller klikk +
            </div>
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
