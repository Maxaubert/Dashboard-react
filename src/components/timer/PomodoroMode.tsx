import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTimers } from '@/context/TimerContext';
import { TimerRing } from './TimerRing';
import { PomodoroControls, EditableTime } from './TimerControls';

const LABELS = { focus: 'FOKUS', pause: 'PAUSE' } as const;

export function PomodoroMode() {
  const ctx = useTimers();
  const p = ctx.getTimer('pomodoro');
  const progress = p.totalMs > 0 ? p.remainingMs / p.totalMs : 0;
  // During pause, the segmented ring stays frozen — the upcoming focus segment
  // shows full (1) until focus actually starts. Only focus phase drains the ring.
  const segmentProgress = p.phase === 'focus' ? progress : 1;

  function handleEditTime(ms: number) {
    // Set the current phase's duration directly in ms — doesn't change the
    // focusMin/pauseMin defaults (those apply on next phase/reset).
    ctx.setPomodoroTime(ms);
  }

  return (
    <div className="tt-mode-body">
      <TimerRing
        progress={progress}
        color={p.color}
        running={p.running}
        segments={{
          total: p.settings.targetCycles,
          completed: p.cycle,
          currentProgress: segmentProgress,
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={p.phase}
            className="tt-ring-label"
            style={{ color: p.color }}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.3 }}
          >
            {LABELS[p.phase]} {p.cycle + (p.phase === 'focus' ? 1 : 0)}/{p.settings.targetCycles}
          </motion.div>
        </AnimatePresence>
        <EditableTime ms={p.remainingMs} color={p.color} onChange={handleEditTime} disabled={p.running} />
      </TimerRing>
      <PomodoroControls
        running={p.running}
        color={p.color}
        onToggle={() => ctx.setPomodoroRunning(!p.running)}
        onReset={ctx.resetPomodoro}
      />
      <div className="tt-pomo-inline">
        <InlineField label="Focus" value={p.settings.focusMin} suffix="min"
          onChange={(v) => ctx.updatePomodoroSettings({ ...p.settings, focusMin: v })} />
        <InlineField label="Break" value={p.settings.pauseMin} suffix="min"
          onChange={(v) => ctx.updatePomodoroSettings({ ...p.settings, pauseMin: v })} />
        <InlineField label="Sessions" value={p.settings.targetCycles}
          onChange={(v) => ctx.updatePomodoroSettings({ ...p.settings, targetCycles: v })} />
      </div>
    </div>
  );
}

function InlineField({ label, value, suffix, onChange }: { label: string; value: number; suffix?: string; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  function commit() {
    const n = parseInt(draft, 10);
    if (!isNaN(n) && n >= 1 && n <= 999) onChange(n);
    setEditing(false);
  }
  if (editing) {
    return (
      <div className="tt-inline-field">
        <div className="tt-inline-label">{label}</div>
        <input
          className="tt-inline-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            else if (e.key === 'Escape') setEditing(false);
          }}
          autoFocus
          inputMode="numeric"
          style={{ width: '40px' }}
        />
      </div>
    );
  }
  return (
    <div className="tt-inline-field">
      <div className="tt-inline-label">{label}</div>
      <button className="tt-inline-value" onClick={() => { setDraft(String(value)); setEditing(true); }}>
        {value}{suffix && <span className="tt-inline-suffix">{suffix}</span>}
      </button>
    </div>
  );
}
