import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface SortableListProps<T extends { id: string }> {
  items: T[];
  /** Render each item. Receives the item and a `dragHandleProps` payload
   *  to spread on the drag handle (or onto the entire item if you want
   *  the whole row draggable). */
  renderItem: (item: T, isDragging: boolean) => ReactNode;
  /** Called once with the new order when a drag completes. */
  onReorder: (items: T[]) => void;
  /** Layout direction. Defaults to vertical. */
  layout?: 'vertical' | 'horizontal' | 'grid';
  className?: string;
  /** Optional class for each item wrapper. */
  itemClassName?: string;
}

/**
 * Generic sortable list. Wraps dnd-kit so callers don't need to learn
 * its API for the common case ("here are items, here's how to render
 * one, give me the new order on drop"). Used by:
 *   - todo.html columns (vertical)
 *   - links.html favorites carousel + grid (horizontal/grid)
 *   - index.html category cards (grid)
 */
export function SortableList<T extends { id: string }>({
  items,
  renderItem,
  onReorder,
  layout = 'vertical',
  className,
  itemClassName,
}: SortableListProps<T>) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const strategy =
    layout === 'horizontal'
      ? horizontalListSortingStrategy
      : layout === 'grid'
      ? rectSortingStrategy
      : verticalListSortingStrategy;

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  }

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={strategy}>
        <div className={className}>
          {items.map((item) => (
            <SortableItem key={item.id} id={item.id} className={itemClassName}>
              {(isDragging) => renderItem(item, isDragging)}
            </SortableItem>
          ))}
        </div>
      </SortableContext>

      <DragOverlay dropAnimation={null}>
        {activeItem && (
          <div className="opacity-90 [&>*]:shadow-[0_24px_64px_rgba(0,0,0,0.6)]">
            {renderItem(activeItem, true)}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

interface SortableItemProps {
  id: string;
  className?: string;
  children: (isDragging: boolean) => ReactNode;
}

function SortableItem({ id, className, children }: SortableItemProps) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1, // hide the original; DragOverlay shows the floating copy
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('touch-none', className)}
      {...attributes}
      {...listeners}
    >
      {children(isDragging)}
    </div>
  );
}
