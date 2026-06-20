import { Modal } from '@/components/ui';
import { SECTION_LABELS, type SectionId } from '@/lib/home';
import { cn } from '@/lib/cn';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * Settings popup: drag to reorder the home sections, toggle to show/hide.
 * Both write through the home mutation immediately (no Save button). The
 * home page itself is static now -- reordering lives here.
 */
export function SettingsModal({
  open,
  onOpenChange,
  order,
  hidden,
  onToggle,
  onReorder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: SectionId[];
  hidden: SectionId[];
  onToggle: (id: SectionId) => void;
  onReorder: (next: SectionId[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = order.indexOf(active.id as SectionId);
    const newIdx = order.indexOf(over.id as SectionId);
    if (oldIdx < 0 || newIdx < 0) return;
    onReorder(arrayMove(order, oldIdx, newIdx));
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Innstillinger" variant="standard" size="md">
      <p className="settings-hint">Dra for å endre rekkefølge. Skru av for å skjule en seksjon.</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div className="settings-list">
            {order.map((id) => (
              <SettingsRow
                key={id}
                id={id}
                visible={!hidden.includes(id)}
                onToggle={onToggle}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </Modal>
  );
}

function SettingsRow({
  id,
  visible,
  onToggle,
}: {
  id: SectionId;
  visible: boolean;
  onToggle: (id: SectionId) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="settings-row">
      <span
        className="settings-row-grip"
        {...attributes}
        {...listeners}
        aria-label="Dra for å flytte"
      >
        <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
          <circle cx="2" cy="2" r="1.5" />
          <circle cx="8" cy="2" r="1.5" />
          <circle cx="2" cy="7" r="1.5" />
          <circle cx="8" cy="7" r="1.5" />
          <circle cx="2" cy="12" r="1.5" />
          <circle cx="8" cy="12" r="1.5" />
        </svg>
      </span>
      <span className="settings-row-label">{SECTION_LABELS[id]}</span>
      <button
        type="button"
        role="switch"
        aria-checked={visible}
        aria-label={SECTION_LABELS[id]}
        className={cn('settings-toggle', visible && 'on')}
        onClick={() => onToggle(id)}
      >
        <span className="settings-toggle-knob" />
      </button>
    </div>
  );
}
