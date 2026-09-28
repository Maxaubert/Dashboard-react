import { Check, CircleCheck, X } from 'lucide-react';
import type { HomeHabit } from '@/api/types';
import { addDays, calcStreak, useHabits } from '@/hooks/useHabits';
import { useMidnightTick } from '@/hooks/useMidnightTick';

export function HabitWidget({ habit, onRemove }: { habit: HomeHabit; onRemove: () => void }) {
  const today = useMidnightTick();
  const { toggleDay } = useHabits();
  const done = habit.completedDays.includes(today);
  const streak = calcStreak(habit.completedDays);
  return (
    <article className="widget-tile" aria-label={habit.name}>
      <div className="widget-heading"><CircleCheck size={20} aria-hidden="true" /><h3>{habit.name}</h3>
        <button className="widget-icon-button" aria-label={`Fjern ${habit.name} fra widgets`} title="Fjern widget (behold historikk)" onClick={onRemove}><X size={18} /></button>
      </div>
      <p className="widget-description">{streak > 0 ? `${streak} ${streak === 1 ? 'dag' : 'dager'} på rad` : 'Én dag om gangen'}</p>
      <div className="habit-week" aria-label="De siste sju dagene">
        {Array.from({ length: 7 }, (_, index) => addDays(today, index - 6)).map((day) => {
          const date = new Date(`${day}T12:00:00`);
          const completed = habit.completedDays.includes(day);
          const label = date.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });
          return <button key={day} className="habit-day" aria-label={label} aria-pressed={completed} title={label} onClick={() => toggleDay(habit.id, day)}>
            <span>{date.toLocaleDateString('nb-NO', { weekday: 'short' }).replace('.', '')}</span>
            <span className="habit-day-mark">{completed ? <Check size={18} /> : date.getDate()}</span>
          </button>;
        })}
      </div>
      <div className="widget-main-action"><button className={`widget-button habit-complete-button ${done ? 'widget-complete' : 'widget-primary'}`} aria-pressed={done} onClick={() => toggleDay(habit.id, today)}>
        <Check size={18} />{done ? 'Angre i dag' : 'Fullfør i dag'}
      </button></div>
    </article>
  );
}
