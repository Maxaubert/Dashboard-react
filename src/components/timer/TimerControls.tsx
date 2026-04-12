import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, Flag } from 'lucide-react';
import { formatHMS, parseTimeString } from '@/hooks/useTimer';

/* ─────────────────────────────────────────────────────────────────────────────
 * Private: CircleBtn
 * ──────────────────────────────────────────────────────────────────────────── */

interface CircleBtnProps {
  icon: React.ReactNode;
  color?: string;
  primary?: boolean;
  disabled?: boolean;
  onClick: () => void;
  label?: string;
}

function CircleBtn({ icon, color, primary, disabled, onClick, label }: CircleBtnProps) {
  const primaryStyle = primary && color
    ? {
        background: `linear-gradient(135deg, ${color}4d, ${color}26)`,
        border: `1px solid ${color}66`,
        boxShadow: `0 0 12px ${color}33`,
        color,
      }
    : undefined;

  return (
    <motion.button
      className="tt-circle-btn"
      style={primaryStyle}
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.05 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
    >
      {icon}
    </motion.button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * CountdownControls
 * ──────────────────────────────────────────────────────────────────────────── */

interface CountdownControlsProps {
  running: boolean;
  finished: boolean;
  color: string;
  onToggle: () => void;
  onReset: () => void;
}

export function CountdownControls({ running, finished, color, onToggle, onReset }: CountdownControlsProps) {
  return (
    <div className="tt-circle-controls">
      <CircleBtn
        icon={running ? <Pause size={18} /> : <Play size={18} />}
        color={color}
        primary
        disabled={finished}
        onClick={onToggle}
        label={running ? 'Pause' : 'Start'}
      />
      <CircleBtn
        icon={<RotateCcw size={18} />}
        onClick={onReset}
        label="Reset"
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * StopwatchControls
 * ──────────────────────────────────────────────────────────────────────────── */

interface StopwatchControlsProps {
  running: boolean;
  elapsedMs: number;
  lapsCount: number;
  color: string;
  onToggle: () => void;
  onLap: () => void;
  onReset: () => void;
}

export function StopwatchControls({
  running,
  elapsedMs,
  lapsCount,
  color,
  onToggle,
  onLap,
  onReset,
}: StopwatchControlsProps) {
  return (
    <div className="tt-circle-controls">
      <CircleBtn
        icon={running ? <Pause size={18} /> : <Play size={18} />}
        color={color}
        primary
        onClick={onToggle}
        label={running ? 'Pause' : 'Start'}
      />
      <CircleBtn
        icon={<Flag size={18} />}
        disabled={!running}
        onClick={onLap}
        label="Lap"
      />
      <CircleBtn
        icon={<RotateCcw size={18} />}
        disabled={elapsedMs === 0 && lapsCount === 0}
        onClick={onReset}
        label="Reset"
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * PomodoroControls
 * ──────────────────────────────────────────────────────────────────────────── */

interface PomodoroControlsProps {
  running: boolean;
  color: string;
  onToggle: () => void;
  onReset: () => void;
}

export function PomodoroControls({ running, color, onToggle, onReset }: PomodoroControlsProps) {
  return (
    <div className="tt-circle-controls">
      <CircleBtn
        icon={running ? <Pause size={18} /> : <Play size={18} />}
        color={color}
        primary
        onClick={onToggle}
        label={running ? 'Pause' : 'Start'}
      />
      <CircleBtn
        icon={<RotateCcw size={18} />}
        onClick={onReset}
        label="Reset"
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * EditableTime
 * ──────────────────────────────────────────────────────────────────────────── */

interface EditableTimeProps {
  ms: number;
  color: string;
  onChange: (ms: number) => void;
  disabled?: boolean;
}

export function EditableTime({ ms, color, onChange, disabled }: EditableTimeProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    if (disabled) return;
    setDraft(formatHMS(ms / 1000));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commit() {
    const parsed = parseTimeString(draft);
    if (parsed !== null) {
      onChange(parsed * 1000);
    }
    setEditing(false);
  }

  function cancel() {
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commit();
    else if (e.key === 'Escape') cancel();
  }

  const springTransition = { type: 'spring' as const, stiffness: 400, damping: 25 };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {!editing && (
        <motion.span
          key="display"
          className={`tt-ring-text${!disabled ? ' tt-ring-text-editable' : ''}`}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={springTransition}
          onClick={startEdit}
        >
          {formatHMS(ms / 1000)}
        </motion.span>
      )}
      {editing && (
        <motion.input
          key="input"
          ref={inputRef}
          className="tt-ring-input"
          style={{ borderColor: `${color}4d` }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={springTransition}
          autoFocus
        />
      )}
    </div>
  );
}
