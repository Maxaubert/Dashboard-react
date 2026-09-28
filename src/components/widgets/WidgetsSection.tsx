import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useHome, useMutateHome } from '@/hooks/useHome';
import { randomId } from '@/lib/randomId';
import { useTimers } from '@/context/TimerContext';
import type { HomeWidget } from '@/api/types';
import { HabitWidget } from './HabitWidget';
import { TimerWidget } from './TimerWidget';
import { AddWidgetDialog } from './AddWidgetDialog';
import type { TimerKind } from './widgetKinds';
import '@/styles/widgets.css';

export function WidgetsSection() {
  const { data: home, isPending, isError, refetch } = useHome();
  const mutate = useMutateHome();
  const timers = useTimers();
  const [adding, setAdding] = useState(false);
  const widgets = home?.widgets ?? [];
  const habits = home?.habits ?? [];
  const visible = widgets.filter((widget) => widget.type !== 'todo' && (widget.type !== 'habit' || habits.some((habit) => habit.id === widget.refId)));

  function addTimer(kind: TimerKind) {
    mutate((prev) => prev.widgets.some((widget) => widget.type === kind) ? prev : {
      ...prev, widgets: [...prev.widgets, { id: randomId(), type: kind, refId: kind }],
    });
    setAdding(false);
  }

  function addHabit(name: string) {
    const id = randomId();
    mutate((prev) => ({ ...prev,
      habits: [...prev.habits, { id, name, color: '#9fd07a', completedDays: [], createdAt: new Date().toISOString() }],
      widgets: [...prev.widgets, { id: randomId(), type: 'habit', refId: id }],
    }));
    setAdding(false);
  }

  function remove(widget: HomeWidget) {
    if (widget.type === 'countdown') timers.resetCountdown();
    if (widget.type === 'stopwatch') timers.resetStopwatch();
    if (widget.type === 'pomodoro') timers.resetPomodoro();
    if (widget.type === 'alarm') timers.stopAlarm();
    mutate((prev) => ({ ...prev, widgets: prev.widgets.filter((item) => item.id !== widget.id) }));
  }

  return (
    <section className="bento-card area-widgets" aria-label="Widgets">
      <div className="widget-section-heading"><div><h2>Widgets</h2><p>Vaner, fokus og tid til det som teller.</p></div>
        <button className="widget-button" onClick={() => setAdding(true)} disabled={!home || isError}><Plus size={18} />Legg til widget</button>
      </div>
      {isPending ? <p className="widget-description" role="status">Laster widgets…</p> : isError ? <div role="alert"><p>Kunne ikke laste widgets.</p><button className="widget-button" onClick={() => void refetch()}>Prøv igjen</button></div> : visible.length === 0 ? (
        <div className="widget-empty"><p>Lag plass til en god vane eller en fokusøkt.</p><span>Velg vanesporing, Pomodoro, nedtelling, stoppeklokke eller alarm.</span></div>
      ) : <div className="widget-grid">{visible.map((widget) => widget.type === 'habit' ? (
        <HabitWidget key={widget.id} habit={habits.find((habit) => habit.id === widget.refId)!} onRemove={() => remove(widget)} />
      ) : <TimerWidget key={widget.id} kind={widget.type as TimerKind} onRemove={() => remove(widget)} />)}</div>}
      {adding && <AddWidgetDialog onClose={() => setAdding(false)} widgets={widgets} habits={habits} onAddHabit={addHabit} onAddTimer={addTimer} onRestoreHabit={(id) => {
        mutate((prev) => ({ ...prev, widgets: [...prev.widgets, { id: randomId(), type: 'habit', refId: id }] }));
        setAdding(false);
      }} />}
    </section>
  );
}
