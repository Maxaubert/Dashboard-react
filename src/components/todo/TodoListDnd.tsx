import { useMemo } from 'react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import type { Todo } from '@/api/types';
import { useMultiContainerDnd } from '@/hooks/useMultiContainerDnd';
import { TodoItem } from './TodoItem';
import { TodoSection } from './TodoSection';

interface TodoListDndProps {
  active: Todo[];
  done: Todo[];
  /** Persist the flat [...active, ...done] list (done flags already applied). */
  onCommit: (flat: Todo[]) => void;
  onEdit: (t: Todo) => void;
  onDelete: (id: string) => void;
  onToggleDone: (id: string) => void;
}

const CONTAINER_IDS = ['active', 'done'] as const;
type ContainerId = (typeof CONTAINER_IDS)[number];

/**
 * Multi-container drag between Aktive ↔ Fullført. Cross-container move
 * flips `done` so the placeholder reflects the destination state during
 * the drag instead of snapping after drop.
 */
export function TodoListDnd({
  active,
  done,
  onCommit,
  onEdit,
  onDelete,
  onToggleDone,
}: TodoListDndProps) {
  const containers = useMemo<Record<ContainerId, Todo[]>>(
    () => ({ active, done }),
    [active, done],
  );

  const dnd = useMultiContainerDnd<Todo, ContainerId>({
    containers,
    containerIds: CONTAINER_IDS,
    itemId: (t) => t.id,
    onCommit,
    transformOnMove: (item, _from, to) => ({ ...item, done: to === 'done' }),
    fingerprint: (t) =>
      `${t.id}:${t.done ? 1 : 0}:${t.priority}:${t.text}:${t.deadline ?? ''}`,
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
      <TodoSection
        id="active"
        label="Aktive"
        items={dnd.local.active}
        emptyMessage="Ingen oppgaver ennå. Klikk «＋ Ny» for å starte. Dra fullførte hit for å gjenåpne."
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleDone={onToggleDone}
      />
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
