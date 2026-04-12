import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { calcStreak, type Habit } from '@/hooks/useHabits';
import { HabitGrid } from './HabitGrid';
import { AddHabitModal } from './AddHabitModal';

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
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{
        background: 'rgba(255, 255, 255, 0.006)',
        border: '1px solid rgba(255, 255, 255, 0.028)',
        borderRadius: 14,
        padding: '14px 16px',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.018), 0 1px 2px rgba(0, 0, 0, 0.4)',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: habit.color }} />
        <span style={{ color: 'rgba(255, 255, 255, 0.75)', fontSize: '0.78rem', fontWeight: 600 }}>
          {habit.name}
        </span>
        {streak > 0 && (
          <span style={{ color: '#f59e0b', fontSize: '0.65rem', fontWeight: 700, marginLeft: 4 }}>
            🔥 {streak}
          </span>
        )}

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label="Habit options"
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                padding: 2,
                color: 'rgba(255, 255, 255, 0.3)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <MoreHorizontal size={14} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              style={{
                background: '#0a0a0a',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 8,
                padding: 4,
                minWidth: 140,
                zIndex: 50,
              }}
            >
              <DropdownMenu.Item
                onSelect={() => setEditOpen(true)}
                style={{ padding: '6px 10px', color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.78rem', cursor: 'pointer', borderRadius: 4, outline: 'none' }}
              >
                Edit
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => setConfirmRemove(true)}
                style={{ padding: '6px 10px', color: '#ef4444', fontSize: '0.78rem', cursor: 'pointer', borderRadius: 4, outline: 'none' }}
              >
                Remove
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      <HabitGrid habit={habit} onToggle={onToggleDay} />

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
    </motion.div>
  );
}
