import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCountdown, playAlarm, notify } from '@/hooks/useTimer';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { TimerRing } from './TimerRing';
import { PomodoroControls, EditableTime } from './TimerControls';

/* ─────────────────────────────────────────────────────────────────────────────
 * Types / Constants
 * ──────────────────────────────────────────────────────────────────────────── */

type Phase = 'focus' | 'pause';

interface PomodoroSettings {
  focusMin: number;
  pauseMin: number;
  targetCycles: number;
}

const DEFAULT_SETTINGS: PomodoroSettings = {
  focusMin: 25,
  pauseMin: 5,
  targetCycles: 4,
};

const COLORS: Record<Phase, string> = { focus: '#34d399', pause: '#06b6d4' };
const LABELS: Record<Phase, string> = { focus: 'FOKUS', pause: 'PAUSE' };

/* ─────────────────────────────────────────────────────────────────────────────
 * Private: InlineField — click-to-edit small settings field
 * ──────────────────────────────────────────────────────────────────────────── */

interface InlineFieldProps {
  label: string;
  value: number;
  suffix?: string;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
}

function InlineField({ label, value, suffix, onChange, min = 1, max = 999 }: InlineFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraft(String(value));
    setEditing(true);
    setTimeout(() => {
      inputRef.current?.select();
    }, 0);
  }

  function commit() {
    const num = parseInt(draft, 10);
    if (!isNaN(num) && num >= min && num <= max) {
      onChange(num);
    }
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commit();
    else if (e.key === 'Escape') setEditing(false);
  }

  return (
    <div className="tt-inline-field">
      <div className="tt-inline-label">{label}</div>
      {editing ? (
        <input
          ref={inputRef}
          className="tt-inline-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          autoFocus
          style={{ width: '48px' }}
        />
      ) : (
        <button className="tt-inline-value" onClick={startEdit}>
          {value}
          {suffix && <span className="tt-inline-suffix">{suffix}</span>}
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * PomodoroMode
 * ──────────────────────────────────────────────────────────────────────────── */

export function PomodoroMode() {
  const [settings, setSettings] = useLocalStorage<PomodoroSettings>(
    'tool-pomodoro-settings-v2',
    DEFAULT_SETTINGS,
  );
  const [phase, setPhase] = useState<Phase>('focus');
  const [cycle, setCycle] = useState(0);

  // Track whether we're responding to a phase/settings change to avoid double-resets
  const phaseSettingsChangeRef = useRef(false);

  const color = COLORS[phase];

  const initialMs = phase === 'focus'
    ? settings.focusMin * 60_000
    : settings.pauseMin * 60_000;

  const onFinish = useCallback(() => {
    playAlarm();
    if (phase === 'focus') {
      const newCycle = cycle + 1;
      setCycle(newCycle);
      if (newCycle >= settings.targetCycles) {
        // All cycles done — reset
        notify('Pomodoro fullført!', `${settings.targetCycles} fokusøkter fullført.`);
        setCycle(0);
        setPhase('focus');
      } else {
        notify('Fokus ferdig', 'Ta en pause!');
        setPhase('pause');
      }
    } else {
      notify('Pause ferdig', 'Klar for ny fokusøkt?');
      setPhase('focus');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cycle, settings.targetCycles]);

  const timer = useCountdown({ initialMs, onFinish });

  // Reset timer when phase or settings change
  useEffect(() => {
    const newMs = phase === 'focus'
      ? settings.focusMin * 60_000
      : settings.pauseMin * 60_000;
    phaseSettingsChangeRef.current = true;
    timer.resetFull(newMs);
  // We intentionally only watch phase and settings values, not timer itself
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, settings.focusMin, settings.pauseMin]);

  // currentProgress for the ring: 1 = full (just started), 0 = depleted (time's up)
  // timer.progress is already remaining/total (1 → 0), exactly what we need

  function handleToggle() {
    timer.setRunning(!timer.running);
  }

  function handleReset() {
    setCycle(0);
    setPhase('focus');
    timer.resetFull(settings.focusMin * 60_000);
  }

  function handleEditableChange(ms: number) {
    // Update the relevant setting when user edits the time inline
    const minutes = Math.round(ms / 60_000);
    if (phase === 'focus') {
      setSettings((prev) => ({ ...prev, focusMin: minutes }));
    } else {
      setSettings((prev) => ({ ...prev, pauseMin: minutes }));
    }
    timer.setTime(ms);
  }

  return (
    <div className="tt-mode-body">
      <TimerRing
        progress={timer.progress}
        color={color}
        running={timer.running}
        segments={{
          total: settings.targetCycles,
          completed: cycle,
          currentProgress: timer.progress,
        }}
      >
        {/* Phase label with animation */}
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            className="tt-ring-label"
            style={{ color }}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2 }}
          >
            {LABELS[phase]} {cycle + 1}/{settings.targetCycles}
          </motion.div>
        </AnimatePresence>

        <EditableTime
          ms={timer.remainingMs}
          color={color}
          onChange={handleEditableChange}
          disabled={timer.running}
        />
      </TimerRing>

      <PomodoroControls
        running={timer.running}
        color={color}
        onToggle={handleToggle}
        onReset={handleReset}
      />

      {/* Inline settings */}
      <div className="tt-pomo-inline">
        <InlineField
          label="FOKUS"
          value={settings.focusMin}
          suffix="m"
          onChange={(val) => setSettings((prev) => ({ ...prev, focusMin: val }))}
          min={1}
          max={120}
        />
        <InlineField
          label="PAUSE"
          value={settings.pauseMin}
          suffix="m"
          onChange={(val) => setSettings((prev) => ({ ...prev, pauseMin: val }))}
          min={1}
          max={60}
        />
        <InlineField
          label="ØKTER"
          value={settings.targetCycles}
          onChange={(val) => setSettings((prev) => ({ ...prev, targetCycles: val }))}
          min={1}
          max={12}
        />
      </div>
    </div>
  );
}
