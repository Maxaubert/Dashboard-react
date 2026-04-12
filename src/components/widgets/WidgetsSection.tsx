import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useHabits } from '@/hooks/useHabits';
import { useWidgets } from '@/hooks/useWidgets';
import { HabitWidget } from './HabitWidget';
import { AddHabitModal } from './AddHabitModal';

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
  const { widgets, addWidget, removeWidgetByRefId } = useWidgets();
  const [habitModalOpen, setHabitModalOpen] = useState(false);

  const hasWidgets = widgets.length > 0;
  const habitMap = new Map(habits.map((h) => [h.id, h]));

  function handleAddHabit(name: string, color: string) {
    const habit = addHabit(name, color);
    addWidget('habit', habit.id);
  }

  function handleRemoveHabit(habitId: string) {
    removeHabit(habitId);
    removeWidgetByRefId(habitId);
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
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <AnimatePresence>
            {widgets.map((w) => {
              if (w.type === 'habit') {
                const habit = habitMap.get(w.refId);
                if (!habit) return null;
                return (
                  <HabitWidget
                    key={w.id}
                    habit={habit}
                    onToggleDay={(date) => toggleDay(habit.id, date)}
                    onUpdate={(patch) => updateHabit(habit.id, patch)}
                    onRemove={() => handleRemoveHabit(habit.id)}
                  />
                );
              }
              return null;
            })}
          </AnimatePresence>
          {/* Dashed "+" card to add a new widget, always at end */}
          <button
            type="button"
            onClick={() => setHabitModalOpen(true)}
            aria-label="Add widget"
            style={{
              background: 'rgba(255, 255, 255, 0.002)',
              border: '1px dashed rgba(255, 255, 255, 0.08)',
              borderRadius: 14,
              padding: '14px 16px',
              // Match HabitWidget width
              width: 180,
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
      </section>

      <AddHabitModal
        open={habitModalOpen}
        onOpenChange={setHabitModalOpen}
        onCreate={handleAddHabit}
      />
    </>
  );
}
