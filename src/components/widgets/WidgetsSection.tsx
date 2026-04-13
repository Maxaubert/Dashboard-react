import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
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
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useHabits } from '@/hooks/useHabits';
import { useWidgets, type Widget } from '@/hooks/useWidgets';
import { HabitWidget } from './HabitWidget';
import { AddWidgetDialog } from './AddWidgetDialog';

type HandleProps = Record<string, unknown>;

function GripHandle({ handleProps }: { handleProps?: HandleProps }) {
  return (
    <span className="db-grip-handle" {...handleProps}>
      <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
        <circle cx="2" cy="2" r="1.5" />
        <circle cx="8" cy="2" r="1.5" />
        <circle cx="2" cy="7" r="1.5" />
        <circle cx="8" cy="7" r="1.5" />
        <circle cx="2" cy="12" r="1.5" />
        <circle cx="8" cy="12" r="1.5" />
      </svg>
    </span>
  );
}

export function WidgetsSection({ handleProps }: { handleProps?: HandleProps }) {
  const { habits, addHabit, updateHabit, removeHabit, toggleDay } = useHabits();
  const { widgets, addWidget, removeWidgetByRefId, reorderWidgets } = useWidgets();
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const hasWidgets = widgets.length > 0;
  const habitMap = new Map(habits.map((h) => [h.id, h]));

  // 5px distance threshold so normal clicks on day cells / context menus aren't
  // mistaken for the start of a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleAddHabit(name: string, color: string) {
    const habit = addHabit(name, color);
    addWidget('habit', habit.id);
  }

  function handleRemoveHabit(habitId: string) {
    removeHabit(habitId);
    removeWidgetByRefId(habitId);
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = widgets.findIndex((w) => w.id === active.id);
    const newIdx = widgets.findIndex((w) => w.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    reorderWidgets(arrayMove(widgets, oldIdx, newIdx));
  }

  return (
    <>
      <section>
        <div className="section-header">
          <span>
            <GripHandle handleProps={handleProps} />
            Widgets
          </span>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={widgets.map((w) => w.id)} strategy={horizontalListSortingStrategy}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <AnimatePresence>
                {widgets.map((w) => (
                  <SortableWidget key={w.id} widget={w}>
                    {renderWidget(w)}
                  </SortableWidget>
                ))}
              </AnimatePresence>
              {/* Dashed "+" card to add a new widget — always at end, not sortable. */}
              <button
                type="button"
                onClick={() => setAddDialogOpen(true)}
                aria-label="Add widget"
                style={{
                  background: 'rgba(255, 255, 255, 0.002)',
                  border: '1px dashed rgba(255, 255, 255, 0.08)',
                  borderRadius: 14,
                  padding: '12px 10px',
                  // Match HabitWidget width
                  width: 164,
                  boxSizing: 'border-box',
                  alignSelf: 'stretch',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'rgba(255, 255, 255, 0.25)',
                  fontSize: hasWidgets ? 32 : 13,
                  fontWeight: 300,
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.25)';
                }}
              >
                {hasWidgets ? '+' : 'Add first habit'}
              </button>
            </div>
          </SortableContext>
        </DndContext>
      </section>

      <AddWidgetDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onCreateHabit={handleAddHabit}
      />
    </>
  );

  function renderWidget(w: Widget) {
    if (w.type === 'habit') {
      const habit = habitMap.get(w.refId);
      if (!habit) return null;
      return (
        <HabitWidget
          habit={habit}
          onToggleDay={(date) => toggleDay(habit.id, date)}
          onUpdate={(patch) => updateHabit(habit.id, patch)}
          onRemove={() => handleRemoveHabit(habit.id)}
        />
      );
    }
    return null;
  }
}

/**
 * Wraps one widget with dnd-kit sortable props. The whole widget is the drag
 * target — no separate grip handle. The 5px activation threshold (set on the
 * PointerSensor above) makes sure day-cell clicks still register.
 */
function SortableWidget({ widget, children }: { widget: Widget; children: React.ReactNode }) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({
    id: widget.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    touchAction: 'none',
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}
