import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, Clock, CheckSquare, Cloud, BarChart3, Timer, X, ChevronLeft } from 'lucide-react';

type Stage = 'pick' | 'configure-habit';

interface AddWidgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateHabit: (name: string, color: string) => void;
}

interface WidgetType {
  id: 'habit' | 'timer' | 'todo' | 'weather' | 'clock' | 'stats';
  label: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  enabled: boolean;
}

const WIDGET_TYPES: WidgetType[] = [
  { id: 'habit', label: 'Habit', subtitle: 'tracker', icon: <Calendar size={20} />, color: '#34d399', enabled: true },
  { id: 'timer', label: 'Timer', subtitle: 'soon', icon: <Timer size={20} />, color: '#ef4444', enabled: false },
  { id: 'todo', label: 'Todo', subtitle: 'soon', icon: <CheckSquare size={20} />, color: '#ec4899', enabled: false },
  { id: 'weather', label: 'Weather', subtitle: 'soon', icon: <Cloud size={20} />, color: '#38bdf8', enabled: false },
  { id: 'clock', label: 'Clock', subtitle: 'soon', icon: <Clock size={20} />, color: '#a855f7', enabled: false },
  { id: 'stats', label: 'Stats', subtitle: 'soon', icon: <BarChart3 size={20} />, color: '#f59e0b', enabled: false },
];

const PRESET_COLORS = ['#34d399', '#a855f7', '#38bdf8', '#f97316', '#eab308', '#ef4444', '#ec4899'];

export function AddWidgetDialog({ open, onOpenChange, onCreateHabit }: AddWidgetDialogProps) {
  const [stage, setStage] = useState<Stage>('pick');
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [selectedId, setSelectedId] = useState<WidgetType['id'] | null>(null);

  // Reset stage when dialog closes
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStage('pick');
        setName('');
        setColor(PRESET_COLORS[0]);
        setSelectedId(null);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  function handlePick(type: WidgetType) {
    if (!type.enabled || selectedId) return;
    setSelectedId(type.id);
    // Brief delay to show selection feedback, then advance
    setTimeout(() => {
      if (type.id === 'habit') {
        setStage('configure-habit');
      }
    }, 450);
  }

  // Clear selection when returning to the pick stage so tiles are reselectable
  useEffect(() => {
    if (stage === 'pick') setSelectedId(null);
  }, [stage]);

  function handleCreateHabit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreateHabit(name.trim(), color);
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 100,
          }}
        />
        <Dialog.Content
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: '#0a0a0a',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 14,
            padding: 20,
            width: 360,
            zIndex: 101,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {stage === 'configure-habit' && (
                <button
                  type="button"
                  onClick={() => setStage('pick')}
                  aria-label="Back"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 2,
                    color: 'rgba(255, 255, 255, 0.4)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
              )}
              <Dialog.Title style={{ color: '#fff', fontSize: '0.92rem', fontWeight: 700, margin: 0 }}>
                {stage === 'pick' ? 'Add widget' : 'Habit tracker'}
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 2,
                  color: 'rgba(255, 255, 255, 0.3)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {/* Stage content */}
          <AnimatePresence mode="wait" initial={false}>
            {stage === 'pick' ? (
              <motion.div
                key="pick"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {WIDGET_TYPES.map((type) => {
                    const isSelected = selectedId === type.id;
                    const isDisabled = !type.enabled;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => handlePick(type)}
                        disabled={isDisabled || (!!selectedId && !isSelected)}
                        style={{
                          background: isSelected
                            ? hexWithAlpha(type.color, 0.1)
                            : 'rgba(255, 255, 255, 0.02)',
                          border: isSelected
                            ? `1px solid ${hexWithAlpha(type.color, 0.35)}`
                            : '1px solid rgba(255, 255, 255, 0.05)',
                          borderRadius: 10,
                          padding: '14px 8px',
                          textAlign: 'center',
                          cursor: isDisabled ? 'not-allowed' : 'pointer',
                          opacity: isDisabled ? 0.45 : 1,
                          transition: 'background 0.18s, border-color 0.18s, color 0.18s',
                        }}
                      >
                        <div style={{
                          color: isSelected ? type.color : 'rgba(255, 255, 255, 0.45)',
                          marginBottom: 6,
                          display: 'flex',
                          justifyContent: 'center',
                          transition: 'color 0.18s',
                        }}>
                          {type.icon}
                        </div>
                        <div style={{
                          color: isSelected ? type.color : 'rgba(255, 255, 255, 0.5)',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          letterSpacing: '0.02em',
                          transition: 'color 0.18s',
                        }}>
                          {type.label}
                        </div>
                        <div style={{
                          color: isSelected ? hexWithAlpha(type.color, 0.45) : 'rgba(255, 255, 255, 0.25)',
                          fontSize: '0.55rem',
                          marginTop: 2,
                          transition: 'color 0.18s',
                        }}>
                          {type.subtitle}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              <motion.form
                key="configure"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
                onSubmit={handleCreateHabit}
              >
                <div style={{ marginBottom: 14 }}>
                  <label style={{
                    display: 'block',
                    color: 'rgba(255, 255, 255, 0.4)',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.10em',
                    marginBottom: 6,
                  }}>
                    Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={40}
                    autoFocus
                    placeholder="Exercise"
                    style={{
                      width: '100%',
                      background: '#050505',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 8,
                      padding: '9px 12px',
                      color: '#fff',
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={{
                    display: 'block',
                    color: 'rgba(255, 255, 255, 0.4)',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.10em',
                    marginBottom: 8,
                  }}>
                    Color
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        aria-label={`Color ${c}`}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          background: c,
                          border: color === c ? '2px solid rgba(255, 255, 255, 0.85)' : '2px solid transparent',
                          cursor: 'pointer',
                          padding: 0,
                          transition: 'transform 0.15s',
                          transform: color === c ? 'scale(1.1)' : 'scale(1)',
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setStage('pick')}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 8,
                      padding: '7px 14px',
                      color: 'rgba(255, 255, 255, 0.6)',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={!name.trim()}
                    style={{
                      background: name.trim() ? color : 'rgba(255, 255, 255, 0.08)',
                      border: 'none',
                      borderRadius: 8,
                      padding: '7px 14px',
                      color: name.trim() ? '#000' : 'rgba(255, 255, 255, 0.3)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: name.trim() ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Add
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
