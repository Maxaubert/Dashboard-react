import { useEffect, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { Todo } from '@/api/types';
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
  onTogglePin: (id: string) => void;
}

type ContainerId = 'active' | 'done';

/**
 * Multi-container drag between Aktive ↔ Fullført. Classic dnd-kit
 * pattern: local state mirrors the props, `onDragOver` moves the item
 * between containers mid-drag so the placeholder appears in the
 * destination (no snap-back). `onDragEnd` commits the flat list.
 */
export function TodoListDnd({
  active,
  done,
  onCommit,
  onEdit,
  onDelete,
  onToggleDone,
  onTogglePin,
}: TodoListDndProps) {
  const [local, setLocal] = useState<Record<ContainerId, Todo[]>>({ active, done });
  const [activeId, setActiveId] = useState<string | null>(null);

  // Re-seed from props when the upstream data actually differs from our
  // local state AND we're not mid-drag. A content-level compare avoids
  // clobbering a just-committed drop before React Query's optimistic
  // cache write has propagated — without it the UI appears to snap back.
  useEffect(() => {
    if (activeId) return;
    const fieldKey = (t: Todo) =>
      `${t.id}:${t.done ? 1 : 0}:${t.pinned ? 1 : 0}:${t.priority}:${t.text}:${t.deadline ?? ''}`;
    const propsKey = [...active, ...done].map(fieldKey).join('|');
    const localKey = [...local.active, ...local.done].map(fieldKey).join('|');
    if (propsKey === localKey) return;
    setLocal({ active, done });
  }, [active, done, activeId, local]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function findContainer(id: string): ContainerId | null {
    if (id === 'active' || id === 'done') return id;
    if (id === 'active-start' || id === 'active-end') return 'active';
    if (id === 'done-start' || id === 'done-end') return 'done';
    if (local.active.some((t) => t.id === id)) return 'active';
    if (local.done.some((t) => t.id === id)) return 'done';
    return null;
  }

  /** Insertion index into destination list given the drag's `over.id`. */
  function insertionIndex(overId: string, toList: Todo[]): number {
    if (overId.endsWith('-start')) return 0;
    if (overId.endsWith('-end') || overId === 'active' || overId === 'done') {
      return toList.length;
    }
    const idx = toList.findIndex((t) => t.id === overId);
    return idx < 0 ? toList.length : idx;
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function handleDragOver(e: DragOverEvent) {
    const { active: dragActive, over } = e;
    if (!over) return;
    const activeItemId = String(dragActive.id);
    const overId = String(over.id);
    const fromC = findContainer(activeItemId);
    const toC = findContainer(overId);
    if (!fromC || !toC || fromC === toC) return;

    setLocal((prev) => {
      const fromList = [...prev[fromC]];
      const toList = [...prev[toC]];
      const fromIdx = fromList.findIndex((t) => t.id === activeItemId);
      if (fromIdx < 0) return prev;
      const [moved] = fromList.splice(fromIdx, 1);
      const flipped: Todo = { ...moved, done: toC === 'done' };
      const insertIdx = insertionIndex(overId, toList);
      toList.splice(insertIdx, 0, flipped);
      return { ...prev, [fromC]: fromList, [toC]: toList };
    });
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active: dragActive, over } = e;
    setActiveId(null);
    if (!over) {
      // Drop missed any droppable — revert to upstream.
      setLocal({ active, done });
      return;
    }
    const activeItemId = String(dragActive.id);
    const overId = String(over.id);
    const containerId = findContainer(activeItemId);
    if (!containerId) {
      onCommit([...local.active, ...local.done]);
      return;
    }

    const list = [...local[containerId]];
    const fromIdx = list.findIndex((t) => t.id === activeItemId);
    if (fromIdx < 0) {
      onCommit([...local.active, ...local.done]);
      return;
    }
    // Reorder within the destination container using the same rail-aware
    // insertion logic so dropping on a section rail lands at the end/start.
    let toIdx = insertionIndex(overId, list);
    const [moved] = list.splice(fromIdx, 1);
    // Compensate for the splice when inserting after the removed index.
    if (toIdx > fromIdx) toIdx -= 1;
    toIdx = Math.max(0, Math.min(list.length, toIdx));
    list.splice(toIdx, 0, moved);
    const next = { ...local, [containerId]: list };
    setLocal(next);
    onCommit([...next.active, ...next.done]);
  }

  const activeTodo =
    activeId
      ? local.active.find((t) => t.id === activeId) ?? local.done.find((t) => t.id === activeId)
      : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setLocal({ active, done });
      }}
    >
      <TodoSection
        id="active"
        label="Aktive"
        items={local.active}
        emptyMessage="Ingen oppgaver ennå. Klikk «＋ Ny» for å starte. Dra fullførte hit for å gjenåpne."
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleDone={onToggleDone}
        onTogglePin={onTogglePin}
      />
      <TodoSection
        id="done"
        label="Fullført"
        items={local.done}
        emptyMessage="Dra oppgaver hit for å markere som ferdig."
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleDone={onToggleDone}
        onTogglePin={onTogglePin}
      />
      <DragOverlay>
        {activeTodo ? (
          <TodoItem
            todo={activeTodo}
            onEdit={() => {}}
            onDelete={() => {}}
            onToggleDone={() => {}}
            onTogglePin={() => {}}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
