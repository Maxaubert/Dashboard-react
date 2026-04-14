import { useEffect, useRef, useState } from 'react';
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
import { CountdownWidget } from './timers/CountdownWidget';
import { PomodoroWidget } from './timers/PomodoroWidget';
import { StopwatchWidget } from './timers/StopwatchWidget';
import { AlarmWidget } from './timers/AlarmWidget';
import { TimerPopup } from './timers/TimerPopup';
import { useTimers, type TimerInstance } from '@/context/TimerContext';

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
  const ctx = useTimers();
  const [popupKind, setPopupKind] = useState<TimerInstance['kind'] | null>(null);

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

  function handleAddTimerWidget(kind: 'alarm' | 'countdown' | 'pomodoro' | 'stopwatch', color: string) {
    ctx.setColor(kind, color);
    ctx.setPersistent(kind, true);
    // The auto-sync effect below will add the widget automatically.
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

  // Auto-sync: add a widget when a timer becomes active, remove it when a
  // timer transitions back to inert. Only acts on *transitions* — never on
  // steady-state — so the widget list fetched from the backend is treated as
  // authoritative on mount. Without this guard, a fresh page load (or a
  // remount after navigating between routes) would see every timer in inert
  // state and incorrectly remove every timer widget from the backend list.
  const prevTimersRef = useRef<typeof ctx.timers | null>(null);
  useEffect(() => {
    const prev = prevTimersRef.current;
    prevTimersRef.current = ctx.timers;
    if (prev === null) return; // first mount — treat backend list as baseline

    function computeShouldShow(t: (typeof ctx.timers)[number]): boolean {
      if (t.kind === 'alarm') return t.persistent || t.running || t.ringing;
      if (t.persistent) return true;
      const hasState =
        (t.kind === 'countdown' && t.remainingMs < t.totalMs) ||
        (t.kind === 'stopwatch' && t.elapsedMs > 0) ||
        (t.kind === 'pomodoro' && (t.cycle > 0 || t.completed));
      return t.running || hasState;
    }

    for (const t of ctx.timers) {
      const p = prev.find((pp) => pp.id === t.id);
      if (!p) continue;
      const wasShow = computeShouldShow(p);
      const isShow = computeShouldShow(t);
      const existingWidget = widgets.find((w) => w.type === t.kind && w.refId === t.kind);

      if (!wasShow && isShow && !existingWidget) {
        addWidget(t.kind, t.kind);
      } else if (wasShow && !isShow && existingWidget) {
        removeWidgetByRefId(t.kind);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.timers]);

  // Auto-open the relevant popup when an alarm starts ringing, when a countdown
  // hits 0, or when a pomodoro completes its final session. Only fires on the
  // rising edge, and only if no popup is already open (don't fight the user
  // mid-edit). If something else is open at the firing-edge, we don't queue an
  // auto-open for later.
  const prevAlarmRingingRef = useRef(false);
  const prevCountdownFinishedRef = useRef(false);
  const prevPomodoroCompletedRef = useRef(false);
  useEffect(() => {
    const alarm = ctx.getTimer('alarm');
    const countdown = ctx.getTimer('countdown');
    const pomodoro = ctx.getTimer('pomodoro');
    const countdownFinished = countdown.remainingMs === 0 && countdown.totalMs > 0;

    const wasRinging = prevAlarmRingingRef.current;
    const wasFinished = prevCountdownFinishedRef.current;
    const wasPomodoroCompleted = prevPomodoroCompletedRef.current;
    prevAlarmRingingRef.current = alarm.ringing;
    prevCountdownFinishedRef.current = countdownFinished;
    prevPomodoroCompletedRef.current = pomodoro.completed;

    if (popupKind !== null) return;
    if (!wasRinging && alarm.ringing) {
      setPopupKind('alarm');
    } else if (!wasFinished && countdownFinished) {
      setPopupKind('countdown');
    } else if (!wasPomodoroCompleted && pomodoro.completed) {
      setPopupKind('pomodoro');
    }
  }, [ctx.timers, popupKind]);

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
        onCreateTimerWidget={handleAddTimerWidget}
      />

      {popupKind && (
        <TimerPopup open={true} onOpenChange={(o) => !o && setPopupKind(null)} kind={popupKind} />
      )}
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
    if (w.type === 'countdown') {
      const t = ctx.getTimer('countdown');
      return (
        <CountdownWidget
          timer={t}
          onClick={() => setPopupKind('countdown')}
          onRemove={() => ctx.setPersistent('countdown', false)}
          onColorChange={(c) => ctx.setColor('countdown', c)}
        />
      );
    }
    if (w.type === 'pomodoro') {
      const t = ctx.getTimer('pomodoro');
      return (
        <PomodoroWidget
          timer={t}
          onClick={() => setPopupKind('pomodoro')}
          onRemove={() => ctx.setPersistent('pomodoro', false)}
          onColorChange={(c) => ctx.setColor('pomodoro', c)}
        />
      );
    }
    if (w.type === 'stopwatch') {
      const t = ctx.getTimer('stopwatch');
      return (
        <StopwatchWidget
          timer={t}
          onClick={() => setPopupKind('stopwatch')}
          onRemove={() => ctx.setPersistent('stopwatch', false)}
          onColorChange={(c) => ctx.setColor('stopwatch', c)}
        />
      );
    }
    if (w.type === 'alarm') {
      const t = ctx.getTimer('alarm');
      return (
        <AlarmWidget
          timer={t}
          onClick={() => setPopupKind('alarm')}
          onRemove={() => ctx.setPersistent('alarm', false)}
          onColorChange={(c) => ctx.setColor('alarm', c)}
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

