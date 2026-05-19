import { useEffect, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { Priority, Todo } from '@/api/types';
import { cn } from '@/lib/cn';
import { PRIORITY_LABEL } from '@/lib/todo';
import { TodoItem, SortableTodoItem } from './TodoItem';
import { TodoSection } from './TodoSection';

type ColumnId = Priority | 'done';
const COLUMN_IDS: ColumnId[] = ['high', 'medium', 'low', 'done'];

interface ColumnsDndProps {
  active: Todo[];
  done: Todo[];
  onCommit: (flat: Todo[]) => void;
  onEdit: (t: Todo) => void;
  onDelete: (id: string) => void;
  onToggleDone: (id: string) => void;
  onTogglePin: (id: string) => void;
  onCreate: (priority: Priority) => void;
}

/**
 * Four-column kanban: Høy / Medium / Lav / Fullført. Dragging between
 * priority columns mutates the todo's priority; dragging into Fullført
 * flips `done` (keeping the original priority so unchecking later puts
 * it back where it came from).
 */
export function ColumnsDnd({
  active,
  done,
  onCommit,
  onEdit,
  onDelete,
  onToggleDone,
  onTogglePin,
  onCreate,
}: ColumnsDndProps) {
  function group(activeItems: Todo[], doneItems: Todo[]): Record<ColumnId, Todo[]> {
    return {
      high: activeItems.filter((t) => t.priority === 'high'),
      medium: activeItems.filter((t) => t.priority === 'medium'),
      low: activeItems.filter((t) => t.priority === 'low'),
      done: doneItems,
    };
  }

  const [local, setLocal] = useState<Record<ColumnId, Todo[]>>(() => group(active, done));
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (activeId) return;
    const next = group(active, done);
    const fieldKey = (t: Todo) =>
      `${t.id}:${t.priority}:${t.done ? 1 : 0}:${t.pinned ? 1 : 0}:${t.text}:${t.deadline ?? ''}`;
    const sameKey = (m: Record<ColumnId, Todo[]>) =>
      COLUMN_IDS.map((c) => m[c].map(fieldKey).join(',')).join('|');
    if (sameKey(next) === sameKey(local)) return;
    setLocal(next);
  }, [active, done, activeId, local]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function findColumn(id: string): ColumnId | null {
    for (const c of COLUMN_IDS) {
      if (id === c) return c;
      if (id === `${c}-start` || id === `${c}-end`) return c;
    }
    for (const c of COLUMN_IDS) {
      if (local[c].some((t) => t.id === id)) return c;
    }
    return null;
  }

  function insertionIndex(overId: string, list: Todo[]): number {
    if (overId.endsWith('-start')) return 0;
    if (overId.endsWith('-end') || (COLUMN_IDS as string[]).includes(overId)) return list.length;
    const idx = list.findIndex((t) => t.id === overId);
    return idx < 0 ? list.length : idx;
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function handleDragOver(e: DragOverEvent) {
    const { active: dragActive, over } = e;
    if (!over) return;
    const activeItemId = String(dragActive.id);
    const overId = String(over.id);
    const fromC = findColumn(activeItemId);
    const toC = findColumn(overId);
    if (!fromC || !toC || fromC === toC) return;

    setLocal((prev) => {
      const fromList = [...prev[fromC]];
      const toList = [...prev[toC]];
      const fromIdx = fromList.findIndex((t) => t.id === activeItemId);
      if (fromIdx < 0) return prev;
      const [moved] = fromList.splice(fromIdx, 1);
      const next: Todo = {
        ...moved,
        // Priority columns set the priority and clear done. Done column
        // sets done and keeps the existing priority (so unchecking later
        // puts it back where it came from).
        priority: toC === 'done' ? moved.priority : toC,
        done: toC === 'done',
      };
      const insertIdx = insertionIndex(overId, toList);
      toList.splice(insertIdx, 0, next);
      return { ...prev, [fromC]: fromList, [toC]: toList };
    });
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active: dragActive, over } = e;
    setActiveId(null);
    if (!over) {
      setLocal(group(active, done));
      return;
    }
    const activeItemId = String(dragActive.id);
    const overId = String(over.id);
    const columnId = findColumn(activeItemId);
    if (!columnId) {
      commit(local);
      return;
    }
    const list = [...local[columnId]];
    const fromIdx = list.findIndex((t) => t.id === activeItemId);
    if (fromIdx < 0) {
      commit(local);
      return;
    }
    let toIdx = insertionIndex(overId, list);
    const [moved] = list.splice(fromIdx, 1);
    if (toIdx > fromIdx) toIdx -= 1;
    toIdx = Math.max(0, Math.min(list.length, toIdx));
    list.splice(toIdx, 0, moved);
    const next = { ...local, [columnId]: list };
    setLocal(next);
    commit(next);
  }

  function commit(state: Record<ColumnId, Todo[]>) {
    const activeFlat = [...state.high, ...state.medium, ...state.low];
    onCommit([...activeFlat, ...state.done]);
  }

  const activeTodo =
    activeId ? COLUMN_IDS.flatMap((c) => local[c]).find((t) => t.id === activeId) ?? null : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setLocal(group(active, done));
      }}
    >
      <div className="columns-grid">
        {(['high', 'medium', 'low'] as Priority[]).map((p) => (
          <ColumnDropZone
            key={p}
            id={p}
            items={local[p]}
            priority={p}
            onCreate={() => onCreate(p)}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleDone={onToggleDone}
            onTogglePin={onTogglePin}
          />
        ))}
      </div>
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

interface ColumnDropZoneProps {
  id: Priority;
  priority: Priority;
  items: Todo[];
  onCreate: () => void;
  onEdit: (t: Todo) => void;
  onDelete: (id: string) => void;
  onToggleDone: (id: string) => void;
  onTogglePin: (id: string) => void;
}

function ColumnDropZone({
  id,
  priority,
  items,
  onCreate,
  onEdit,
  onDelete,
  onToggleDone,
  onTogglePin,
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
                onTogglePin={() => onTogglePin(t.id)}
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
