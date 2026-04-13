import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { X, Play, Pause, RotateCcw } from 'lucide-react';
import { useTimers, type TimerInstance } from '@/context/TimerContext';
import { TimerRing } from '@/components/timer/TimerRing';
import { CountdownControls, PomodoroControls, EditableTime } from '@/components/timer/TimerControls';
import { formatStopwatch } from '@/hooks/useTimer';

interface TimerPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: TimerInstance['kind'];
}

const LABELS = { focus: 'FOKUS', pause: 'PAUSE' } as const;

export function TimerPopup({ open, onOpenChange, kind }: TimerPopupProps) {
  const ctx = useTimers();
  const timer = ctx.getTimer(kind);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(6px)',
            zIndex: 100,
          }}
        />
        <Dialog.Content asChild>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }}
            animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
            exit={{ opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              background: '#0a0a0a',
              border: `1px solid ${hexWithAlpha(timer.color, 0.15)}`,
              borderRadius: 20,
              padding: 24,
              width: 440,
              zIndex: 101,
              boxShadow: `0 24px 60px rgba(0, 0, 0, 0.8), 0 0 32px ${hexWithAlpha(timer.color, 0.1)}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Dialog.Title
                style={{
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontSize: '0.65rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                {kind === 'countdown' ? 'Timer' : kind === 'stopwatch' ? 'Stopwatch' : 'Pomodoro'}
              </Dialog.Title>
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
                  }}
                >
                  <X size={16} />
                </button>
              </Dialog.Close>
            </div>
            <div className="tt-mode-body">
              {kind === 'countdown' && <CountdownBody />}
              {kind === 'stopwatch' && <StopwatchBody />}
              {kind === 'pomodoro' && <PomodoroBody />}
            </div>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CountdownBody() {
  const ctx = useTimers();
  const timer = ctx.getTimer('countdown');
  const progress = timer.totalMs > 0 ? timer.remainingMs / timer.totalMs : 0;
  const finished = timer.remainingMs === 0;
  return (
    <>
      <TimerRing progress={progress} color={timer.color} running={timer.running} size={320}>
        {finished && <div className="tt-ring-label" style={{ color: timer.color }}>FERDIG</div>}
        <EditableTime ms={timer.remainingMs} color={timer.color} onChange={ctx.setCountdownTime} disabled={timer.running} />
      </TimerRing>
      <CountdownControls
        running={timer.running}
        finished={finished}
        color={timer.color}
        onToggle={() => ctx.setCountdownRunning(!timer.running)}
        onReset={ctx.resetCountdown}
      />
    </>
  );
}

/**
 * Stopwatch controls in the popup: play/pause + reset only. No Lap button.
 */
function StopwatchBody() {
  const ctx = useTimers();
  const timer = ctx.getTimer('stopwatch');
  return (
    <>
      <TimerRing progress={1} color={timer.color} running={timer.running} size={320}>
        {/* Stopwatch text is longer than countdown/pomodoro (has centiseconds) so it
            needs a smaller font override to fit inside the 320px ring. */}
        <div
          className="tt-ring-text"
          style={{ fontSize: '3.2rem' }}
        >
          {formatStopwatch(timer.elapsedMs)}
        </div>
      </TimerRing>
      <div className="tt-circle-controls">
        <motion.button
          className="tt-circle-btn"
          style={{
            background: `linear-gradient(135deg, ${timer.color}4d, ${timer.color}26)`,
            border: `1px solid ${timer.color}66`,
            boxShadow: `0 0 12px ${timer.color}33`,
            color: timer.color,
          }}
          onClick={() => ctx.setStopwatchRunning(!timer.running)}
          aria-label={timer.running ? 'Pause' : 'Start'}
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        >
          {timer.running ? <Pause size={18} /> : <Play size={18} />}
        </motion.button>
        <motion.button
          className="tt-circle-btn"
          onClick={ctx.resetStopwatch}
          aria-label="Nullstill"
          disabled={timer.elapsedMs === 0}
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        >
          <RotateCcw size={16} />
        </motion.button>
      </div>
    </>
  );
}

function PomodoroBody() {
  const ctx = useTimers();
  const timer = ctx.getTimer('pomodoro');
  const progress = timer.totalMs > 0 ? timer.remainingMs / timer.totalMs : 0;
  // During pause the ring stays frozen — upcoming focus segment full.
  const segmentProgress = timer.phase === 'focus' ? progress : 1;

  function handleEditTime(ms: number) {
    // Direct ms override — doesn't change the focusMin/pauseMin defaults.
    ctx.setPomodoroTime(ms);
  }

  return (
    <>
      <TimerRing
        progress={progress}
        color={timer.color}
        running={timer.running}
        size={320}
        segments={{ total: timer.settings.targetCycles, completed: timer.cycle, currentProgress: segmentProgress }}
      >
        <div className="tt-ring-label" style={{ color: timer.color }}>
          {LABELS[timer.phase]} {timer.cycle + (timer.phase === 'focus' ? 1 : 0)}/{timer.settings.targetCycles}
        </div>
        <EditableTime ms={timer.remainingMs} color={timer.color} onChange={handleEditTime} disabled={timer.running} />
      </TimerRing>
      <PomodoroControls
        running={timer.running}
        color={timer.color}
        onToggle={() => ctx.setPomodoroRunning(!timer.running)}
        onReset={ctx.resetPomodoro}
      />
      {/* Inline settings: numbers only, no "min" suffix */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 18 }}>
        <InlineNumField
          label="Focus"
          value={timer.settings.focusMin}
          onChange={(v) => ctx.updatePomodoroSettings({ ...timer.settings, focusMin: v })}
        />
        <InlineNumField
          label="Break"
          value={timer.settings.pauseMin}
          onChange={(v) => ctx.updatePomodoroSettings({ ...timer.settings, pauseMin: v })}
        />
        <InlineNumField
          label="Sessions"
          value={timer.settings.targetCycles}
          onChange={(v) => ctx.updatePomodoroSettings({ ...timer.settings, targetCycles: v })}
        />
      </div>
    </>
  );
}

function InlineNumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  function commit() {
    const n = parseInt(draft, 10);
    // Upper bound is a loose sanity check — per-field clamping happens in the
    // reducer (focus ≤ 180, break ≤ 60, sessions ≤ 12).
    if (!isNaN(n) && n >= 1 && n <= 999) onChange(n);
    setEditing(false);
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        color: 'rgba(255, 255, 255, 0.3)',
        fontSize: '0.55rem',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        marginBottom: 4,
      }}>
        {label}
      </div>
      {editing ? (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            else if (e.key === 'Escape') setEditing(false);
          }}
          autoFocus
          inputMode="numeric"
          style={{
            width: 36,
            background: '#050505',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: 5,
            padding: '2px 6px',
            color: '#fff',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.68rem',
            textAlign: 'center',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => { setDraft(String(value)); setEditing(true); }}
          style={{
            background: '#050505',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 5,
            padding: '2px 8px',
            color: 'rgba(255, 255, 255, 0.7)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.68rem',
            cursor: 'pointer',
            minWidth: 36,
            lineHeight: 1.3,
          }}
        >
          {value}
        </button>
      )}
    </div>
  );
}

function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
