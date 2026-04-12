import { motion } from 'framer-motion';
import { todayISO, type Habit } from '@/hooks/useHabits';

interface HabitGridProps {
  habit: Habit;
  onToggle: (date: string) => void;
}

const CELL = 14;
const GAP = 3;

export function HabitGrid({ habit, onToggle }: HabitGridProps) {
  const today = todayISO();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Mon-first

  const completedSet = new Set(habit.completedDays);

  const cells: Array<{ key: string; date?: string; state: 'past-done' | 'past-miss' | 'today-done' | 'today-miss' | 'future' | 'empty' }> = [];

  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ key: `empty-${i}`, state: 'empty' });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = date === today;
    const isFuture = date > today;
    const isDone = completedSet.has(date);
    let state: 'past-done' | 'past-miss' | 'today-done' | 'today-miss' | 'future';
    if (isFuture) state = 'future';
    else if (isToday && isDone) state = 'today-done';
    else if (isToday) state = 'today-miss';
    else if (isDone) state = 'past-done';
    else state = 'past-miss';
    cells.push({ key: date, date, state });
  }

  return (
    <div
      role="grid"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(7, ${CELL}px)`,
        gap: `${GAP}px`,
      }}
    >
      {cells.map((c) => {
        if (c.state === 'empty' || !c.date) {
          return <div key={c.key} style={{ width: CELL, height: CELL }} />;
        }
        const bg = cellBackground(c.state, habit.color);
        const outline = (c.state === 'today-done' || c.state === 'today-miss')
          ? `2px solid ${habit.color}`
          : undefined;
        const interactive = c.state !== 'future';
        return (
          <motion.button
            key={c.key}
            type="button"
            aria-label={`${c.date}: ${c.state === 'past-done' || c.state === 'today-done' ? 'completed' : 'not completed'}`}
            onClick={interactive ? () => onToggle(c.date!) : undefined}
            disabled={!interactive}
            whileTap={interactive ? { scale: 0.85 } : undefined}
            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            style={{
              width: CELL,
              height: CELL,
              padding: 0,
              border: 'none',
              borderRadius: 3,
              background: bg,
              outline,
              outlineOffset: '-1px',
              cursor: interactive ? 'pointer' : 'default',
            }}
          />
        );
      })}
    </div>
  );
}

function cellBackground(state: string, color: string): string {
  switch (state) {
    case 'past-done':
    case 'today-done':
      return hexWithAlpha(color, 0.7);
    case 'past-miss':
    case 'today-miss':
      return 'rgba(255, 255, 255, 0.06)';
    case 'future':
      return 'rgba(255, 255, 255, 0.03)';
    default:
      return 'transparent';
  }
}

function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
