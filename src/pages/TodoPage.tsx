import { useEffect, useMemo, useRef, useState } from 'react';
import { Pin, PinOff } from 'lucide-react';
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Modal, useToast } from '@/components/ui';
import { useSaveTodos, useTodos } from '@/hooks/useTodos';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useWidgets } from '@/hooks/useWidgets';
import type { Priority, Todo } from '@/api/types';
import { cn } from '@/lib/cn';
import { playTodoCompleteSound } from '@/lib/sounds';

const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'Høy',
  medium: 'Medium',
  low: 'Lav',
};

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
    // Also drop any dangling widgets pointing at purged todos.
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

    // Sync widget side-effect if pin state changed (or it's a new pinned todo).
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
    // If the deleted todo had a widget, remove it too.
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

/* ── List view with cross-section drag ─────────────────────────────────── */
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
function TodoListDnd({
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

interface TodoSectionProps {
  id: 'active' | 'done';
  label: string;
  items: Todo[];
  emptyMessage: string;
  onEdit: (t: Todo) => void;
  onDelete: (id: string) => void;
  onToggleDone: (id: string) => void;
  onTogglePin: (id: string) => void;
}

function TodoSection({
  id,
  label,
  items,
  emptyMessage,
  onEdit,
  onDelete,
  onToggleDone,
  onTogglePin,
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

function SortableTodoItem(props: {
  todo: Todo;
  onEdit: () => void;
  onDelete: () => void;
  onToggleDone: () => void;
  onTogglePin: () => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: props.todo.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Hide the original while the DragOverlay renders the floating copy —
    // otherwise the destination container shows both the overlay AND the
    // mirrored row.
    opacity: isDragging ? 0 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TodoItem {...props} />
    </div>
  );
}

/* ── Columns view with cross-column drag + done drag ───────────────────── */
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

function ColumnsDnd({
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
    <>
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
    </>
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

/* ── Todo item row — V3 Minimal editorial ───────────────────────────────── */
interface TodoItemProps {
  todo: Todo;
  onEdit: () => void;
  onDelete: () => void;
  onToggleDone: () => void;
  onTogglePin: () => void;
}

function TodoItem({ todo, onEdit, onDelete, onToggleDone, onTogglePin }: TodoItemProps) {
  const deadlineInfo = todo.deadline ? formatDeadline(todo.deadline) : null;

  return (
    <div
      className={cn(
        'todo-item',
        `priority-${todo.priority}`,
        todo.done && 'done',
        todo.pinned && 'pinned',
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
          className={cn('todo-action-btn', 'pin', todo.pinned && 'pinned')}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
          aria-label={todo.pinned ? 'Løsne' : 'Fest til dashboard'}
          title={todo.pinned ? 'Løsne' : 'Fest til dashboard'}
        >
          {todo.pinned ? <PinOff size={14} /> : <Pin size={14} />}
        </button>
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
 * Text-style date input showing dd/mm/yy, storing ISO (yyyy-mm-dd).
 *
 * The native `<input type="date">` follows browser locale and can't be
 * forced into dd/mm/yy cross-browser, so this wraps a text input with
 * auto-slash masking and parses on blur. Two-digit years are assumed
 * to live in the 2000s (e.g. "26" → "2026").
 */
function DeadlineInput({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const [text, setText] = useState(() => (value ? isoToDisplay(value) : ''));

  // Keep local text in sync when the underlying ISO value changes from outside.
  useEffect(() => {
    setText(value ? isoToDisplay(value) : '');
  }, [value]);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^\d]/g, '').slice(0, 6);
    // Auto-slash: DD/MM/YY as the user types.
    let masked = raw;
    if (raw.length >= 3 && raw.length <= 4) masked = `${raw.slice(0, 2)}/${raw.slice(2)}`;
    else if (raw.length >= 5) masked = `${raw.slice(0, 2)}/${raw.slice(2, 4)}/${raw.slice(4, 6)}`;
    setText(masked);
  }

  function commit() {
    if (!text.trim()) {
      onChange(null);
      return;
    }
    const iso = displayToIso(text);
    if (iso) {
      onChange(iso);
      setText(isoToDisplay(iso));
    } else {
      // Invalid parse — snap back to last valid value.
      setText(value ? isoToDisplay(value) : '');
    }
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      placeholder="dd/mm/åå"
      maxLength={8}
      autoComplete="off"
      value={text}
      onChange={handleInput}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

function isoToDisplay(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y.slice(-2)}`;
}

function displayToIso(text: string): string | null {
  const m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{1,4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  let yyyy = Number(m[3]);
  if (m[3].length === 2) yyyy = 2000 + yyyy;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const date = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (
    date.getUTCFullYear() !== yyyy ||
    date.getUTCMonth() !== mm - 1 ||
    date.getUTCDate() !== dd
  ) {
    return null;
  }
  const mmStr = String(mm).padStart(2, '0');
  const ddStr = String(dd).padStart(2, '0');
  return `${yyyy}-${mmStr}-${ddStr}`;
}

export function formatDeadline(iso: string): { label: string; overdue: boolean } {
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
export interface TodoModalProps {
  item: Todo | null;
  defaultPriority: Priority;
  onClose: () => void;
  onSave: (item: Todo) => void;
  onDelete?: () => void;
}

export function TodoModal({ item, defaultPriority, onClose, onSave, onDelete }: TodoModalProps) {
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
          <div className="todo-deadline-row">
            <DeadlineInput
              id="t-deadline"
              value={form.deadline ?? null}
              onChange={(next) => update('deadline', next)}
            />
            {form.deadline && (
              <button
                type="button"
                className="todo-deadline-clear"
                onClick={() => update('deadline', null)}
                aria-label="Fjern frist"
                title="Fjern frist"
              >
                ✕ Fjern
              </button>
            )}
          </div>
        </div>

        <div className="todo-field">
          <label className="todo-pin-toggle">
            <input
              type="checkbox"
              checked={form.pinned ?? false}
              onChange={(e) => update('pinned', e.target.checked)}
            />
            <span>Fest til dashboard</span>
          </label>
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
