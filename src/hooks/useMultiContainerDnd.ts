import { useEffect, useState } from 'react';
import {
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

/**
 * Multi-container drag with mid-drag mirroring. Handles the shared shape
 * across TodoListDnd (Aktive ↔ Fullført) and ColumnsDnd (priority columns
 * + Fullført):
 *
 * - Mirrors upstream containers into local state, re-seeding only when
 *   the user is NOT mid-drag AND the content fingerprint actually changed
 *   (so a just-committed drop doesn't snap back before optimistic cache
 *   propagates).
 * - Single `pointerWithin` collision strategy + 5px PointerSensor +
 *   KeyboardSensor — both consumers used these.
 * - Container identification accepts the bare container id and the
 *   `${id}-start` / `${id}-end` rail variants used for drop targets.
 * - `onDragOver` moves the active item into the destination container
 *   mid-drag, optionally applying `transformOnMove` (Todo flips `done`;
 *   Column flips both `priority` and `done`).
 * - `onDragEnd` re-applies rail-aware insertion within the destination
 *   container, then commits a flat list ordered by `containerIds`.
 *
 * LinksLibrary is intentionally NOT a consumer — its section-vs-link drag
 * duality, custom collision detection, and click-suppression on drop make
 * it a poor fit; forcing it through here would bloat the API.
 */
export interface UseMultiContainerDndOptions<T, CId extends string> {
  /** Current upstream state keyed by container id. */
  containers: Record<CId, T[]>;
  /** Ordered container ids — drives findContainer, rail detection, and commit order. */
  containerIds: readonly CId[];
  /** How to extract a string id from an item. */
  itemId: (item: T) => string;
  /** Persist the flat (containerIds-ordered) list when a drop commits. */
  onCommit: (flat: T[]) => void;
  /**
   * Optionally transform an item as it crosses container boundaries.
   * Used by Todo (flip `done`) and Column (flip `priority` + `done`).
   */
  transformOnMove?: (item: T, fromContainer: CId, toContainer: CId) => T;
  /**
   * Content fingerprint per item — used by the re-seed effect to detect
   * upstream changes that matter for rendering. Default uses item id
   * only; callers with field-level updates (text, deadline, etc.) should
   * include those fields.
   */
  fingerprint?: (item: T) => string;
  /** PointerSensor activation distance in px. Default 5. */
  sensorDistance?: number;
}

export interface UseMultiContainerDndResult<T, CId extends string> {
  /** Mirrored container state — render from this, not from `containers`. */
  local: Record<CId, T[]>;
  /** The currently-dragged item, or null. Use for DragOverlay rendering. */
  activeItem: T | null;
  sensors: ReturnType<typeof useSensors>;
  collisionDetection: CollisionDetection;
  onDragStart: (e: DragStartEvent) => void;
  onDragOver: (e: DragOverEvent) => void;
  onDragEnd: (e: DragEndEvent) => void;
  onDragCancel: () => void;
}

export function useMultiContainerDnd<T, CId extends string>(
  opts: UseMultiContainerDndOptions<T, CId>,
): UseMultiContainerDndResult<T, CId> {
  const {
    containers,
    containerIds,
    itemId,
    onCommit,
    transformOnMove,
    fingerprint = itemId,
    sensorDistance = 5,
  } = opts;

  const [local, setLocal] = useState<Record<CId, T[]>>(containers);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Re-seed local from upstream when content actually differs AND no drag
  // is in progress. Prevents a just-committed drop from snapping back
  // before React Query's optimistic cache write has propagated.
  useEffect(() => {
    if (activeId) return;
    const fp = (state: Record<CId, T[]>) =>
      containerIds.map((c) => state[c].map(fingerprint).join(',')).join('|');
    if (fp(containers) === fp(local)) return;
    setLocal(containers);
    // fingerprint and containerIds are typically inline-defined by callers;
    // including them in deps would cause re-seed on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containers, local, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: sensorDistance } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function findContainer(id: string): CId | null {
    for (const c of containerIds) {
      if (id === c || id === `${c}-start` || id === `${c}-end`) return c;
    }
    for (const c of containerIds) {
      if (local[c].some((t) => itemId(t) === id)) return c;
    }
    return null;
  }

  /** Rail-aware insertion index into `toList` given the drag's `over.id`. */
  function insertionIndex(overId: string, toList: T[]): number {
    if (overId.endsWith('-start')) return 0;
    if (overId.endsWith('-end') || (containerIds as readonly string[]).includes(overId)) {
      return toList.length;
    }
    const idx = toList.findIndex((t) => itemId(t) === overId);
    return idx < 0 ? toList.length : idx;
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const aId = String(active.id);
    const oId = String(over.id);
    const fromC = findContainer(aId);
    const toC = findContainer(oId);
    if (!fromC || !toC || fromC === toC) return;

    setLocal((prev) => {
      const fromList = [...prev[fromC]];
      const toList = [...prev[toC]];
      const fromIdx = fromList.findIndex((t) => itemId(t) === aId);
      if (fromIdx < 0) return prev;
      const [moved] = fromList.splice(fromIdx, 1);
      const transformed = transformOnMove ? transformOnMove(moved, fromC, toC) : moved;
      const insertIdx = insertionIndex(oId, toList);
      toList.splice(insertIdx, 0, transformed);
      return { ...prev, [fromC]: fromList, [toC]: toList };
    });
  }

  function commit(state: Record<CId, T[]>) {
    const flat = containerIds.flatMap((c) => state[c]);
    onCommit(flat);
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    if (!over) {
      // Missed all droppables — revert.
      setLocal(containers);
      return;
    }
    const aId = String(active.id);
    const oId = String(over.id);
    const containerId = findContainer(aId);
    if (!containerId) {
      commit(local);
      return;
    }
    const list = [...local[containerId]];
    const fromIdx = list.findIndex((t) => itemId(t) === aId);
    if (fromIdx < 0) {
      commit(local);
      return;
    }
    // Within-container reorder using the same rail-aware logic.
    let toIdx = insertionIndex(oId, list);
    const [moved] = list.splice(fromIdx, 1);
    // Compensate for the splice when inserting after the removed index.
    if (toIdx > fromIdx) toIdx -= 1;
    toIdx = Math.max(0, Math.min(list.length, toIdx));
    list.splice(toIdx, 0, moved);
    const next = { ...local, [containerId]: list };
    setLocal(next);
    commit(next);
  }

  function onDragCancel() {
    setActiveId(null);
    setLocal(containers);
  }

  const activeItem =
    activeId != null
      ? containerIds.flatMap((c) => local[c]).find((t) => itemId(t) === activeId) ?? null
      : null;

  return {
    local,
    activeItem,
    sensors,
    collisionDetection: pointerWithin,
    onDragStart,
    onDragOver,
    onDragEnd,
    onDragCancel,
  };
}
