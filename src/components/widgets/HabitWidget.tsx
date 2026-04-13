import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { calcStreak, type Habit } from '@/hooks/useHabits';
import { HabitGrid } from './HabitGrid';
import { AddHabitModal } from './AddHabitModal';
import { WidgetShell } from './WidgetShell';

interface HabitWidgetProps {
  habit: Habit;
  onToggleDay: (date: string) => void;
  onUpdate: (patch: { name?: string; color?: string }) => void;
  onRemove: () => void;
}

export function HabitWidget({ habit, onToggleDay, onUpdate, onRemove }: HabitWidgetProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const streak = calcStreak(habit.completedDays);

  return (
    <>
      <WidgetShell
        menu={[
          { label: 'Edit', onSelect: () => setEditOpen(true) },
          { label: 'Remove', onSelect: () => setConfirmRemove(true), destructive: true },
        ]}
        style={{ position: 'relative', minHeight: undefined }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.78rem', fontWeight: 700 }}>
            {habit.name}
          </span>
          {streak > 0 && (
            <span style={{ color: '#f59e0b', fontSize: '0.65rem', fontWeight: 700, marginLeft: 'auto' }}>
              🔥 {streak}
            </span>
          )}
        </div>
        <HabitGrid habit={habit} onToggle={onToggleDay} />
      </WidgetShell>

      <AddHabitModal
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initialName={habit.name}
        initialColor={habit.color}
        onCreate={(name, color) => onUpdate({ name, color })}
      />

      <AnimatePresence>
        {confirmRemove && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(4px)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={() => setConfirmRemove(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              style={{
                background: '#0a0a0a',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 16,
                padding: 24,
                width: 320,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 700, marginBottom: 8 }}>
                Remove "{habit.name}"?
              </div>
              <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.82rem', marginBottom: 20 }}>
                This will delete all tracked days. Cannot be undone.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setConfirmRemove(false)}
                  style={{ background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 8, padding: '8px 16px', color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmRemove(false);
                    onRemove();
                  }}
                  style={{ background: '#ef4444', border: 'none', borderRadius: 8, padding: '8px 16px', color: '#fff', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Remove
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
