import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { X, Play, Pause, RotateCcw } from 'lucide-react';
import { useTimers, type TimerInstance, type AlarmTimer } from '@/context/TimerContext';
import { TimerRing } from '@/components/timer/TimerRing';
import { CountdownControls, PomodoroControls, EditableTime } from '@/components/timer/TimerControls';
import { formatStopwatch } from '@/lib/timerUtils';

interface TimerPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: TimerInstance['kind'];
}

const LABELS = { focus: 'FOKUS', pause: 'PAUSE' } as const;

export function TimerPopup({ open, onOpenChange, kind }: TimerPopupProps) {
  const ctx = useTimers();
  const timer = ctx.getTimer(kind);
  const blockClose = kind === 'alarm' && (timer as AlarmTimer).ringing;

  function handleOpenChange(next: boolean) {
    // Block close while the alarm is ringing.
    if (blockClose && !next) return;

    if (!next) {
      // Closing the countdown popup at completion → reset (stops looping chime,
      // and removes auto-summoned widget via the auto-sync rule).
      if (kind === 'countdown') {
        const c = ctx.getTimer('countdown');
        if (c.remainingMs === 0) ctx.resetCountdown();
      }
      // Closing the pomodoro popup after all sessions completed → reset.
      if (kind === 'pomodoro') {
        const p = ctx.getTimer('pomodoro');
        if (p.completed) ctx.resetPomodoro();
      }
      // Closing the stopwatch popup with stopwatch paused (and not persistent) →
      // reset so the auto-summoned widget disappears.
      if (kind === 'stopwatch') {
        const s = ctx.getTimer('stopwatch');
        if (!s.persistent && !s.running && s.elapsedMs > 0) ctx.resetStopwatch();
      }
    }

    onOpenChange(next);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={handleOpenChange}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(6px)',
            zIndex: 100,
          }}
        />
        <Dialog.Content
          asChild
          onPointerDownOutside={(e) => { if (blockClose) e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (blockClose) e.preventDefault(); }}
          onInteractOutside={(e) => { if (blockClose) e.preventDefault(); }}
        >
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
              // Kill the browser focus ring that appears when the dialog takes
              // focus (e.g. after pressing Enter to commit an edit). Radix
              // still manages the focus trap and programmatic focus moves.
              outline: 'none',
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
                {kind === 'countdown' ? 'Timer'
                  : kind === 'stopwatch' ? 'Stopwatch'
                  : kind === 'pomodoro' ? 'Pomodoro'
                  : 'Alarm'}
              </Dialog.Title>
              {!blockClose && (
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
              )}
            </div>
            <div className="tt-mode-body">
              {kind === 'countdown' && <CountdownBody />}
              {kind === 'stopwatch' && <StopwatchBody />}
              {kind === 'pomodoro' && <PomodoroBody />}
              {kind === 'alarm' && <AlarmBody />}
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

function formatRemainingPopup(ms: number): string {
  if (ms <= 0) return 'now';
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `in ${h}h ${m}m`;
  if (h > 0) return `in ${h}h`;
  return `in ${m}m`;
}

function AlarmBody() {
  const ctx = useTimers();
  const t = ctx.getTimer('alarm');

  // 1Hz refresh while armed/ringing.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!t.running && !t.ringing) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [t.running, t.ringing]);

  const remainingMs = t.fireAt !== null ? t.fireAt - Date.now() : 0;
  const buttonLabel = t.ringing ? 'STOP' : t.running ? 'CANCEL' : 'SET ALARM';
  const buttonBg = t.ringing ? '#ef4444' : t.color;

  function handleButton() {
    if (t.ringing) ctx.stopAlarm();
    else if (t.running) ctx.cancelAlarm();
    else ctx.armAlarm();
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        minHeight: 320,
        padding: '20px 0',
      }}
    >
      <div
        style={{
          color: 'rgba(255,255,255,0.4)',
          fontSize: '0.7rem',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
        }}
      >
        {t.ringing ? 'RINGING' : 'RINGS AT'}
      </div>
      <PopupEditableHHMM
        value={t.targetTime}
        color={t.color}
        disabled={t.running || t.ringing}
        onChange={(time) => ctx.setAlarmTime(time)}
      />
      {t.running && !t.ringing && (
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '1rem' }}>
          {formatRemainingPopup(remainingMs)}
        </div>
      )}
      {!t.running && !t.ringing && (
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>click time to edit</div>
      )}
      <button
        type="button"
        onClick={handleButton}
        style={{
          background: buttonBg,
          color: '#000',
          border: 'none',
          borderRadius: 999,
          padding: '14px 44px',
          fontSize: '0.82rem',
          fontWeight: 700,
          letterSpacing: '0.18em',
          cursor: 'pointer',
          marginTop: 8,
        }}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

interface PopupEditableHHMMProps {
  value: string;
  color: string;
  disabled: boolean;
  onChange: (next: string) => void;
}

/**
 * Live-format an HH:MM input as the user types: strip non-digits, cap at 4
 * digits, and insert the colon as soon as 2 digits exist so the user doesn't
 * have to type it. Typing "1" → "1"; "15" → "15:"; "153" → "15:3";
 * "1530" → "15:30". `parseTimeString` strips trailing colons before parsing,
 * so a committed "15:" parses as 15 minutes.
 *
 * Backspace edge: if the user deletes a character and only the auto-inserted
 * colon goes away (digit count unchanged), drop a digit from the right
 * instead of re-inserting the colon — otherwise the colon is unbackspaceable.
 */
function formatHHMMDraft(raw: string, prev: string): string {
  let digits = raw.replace(/\D/g, '').slice(0, 4);
  const prevDigits = prev.replace(/\D/g, '');
  if (
    raw.length < prev.length &&
    digits.length === prevDigits.length &&
    prev.includes(':') &&
    !raw.includes(':')
  ) {
    digits = digits.slice(0, -1);
  }
  if (digits.length < 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function PopupEditableHHMM({ value, color, disabled, onChange }: PopupEditableHHMMProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function commit() {
    const trimmed = draft.trim();
    const m = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
    if (m) {
      const h = parseInt(m[1], 10);
      const min = parseInt(m[2], 10);
      if (h >= 0 && h <= 23 && min >= 0 && min <= 59) {
        onChange(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
      }
    }
    setEditing(false);
  }

  // Same trick as AlarmMode: shared box keeps the layout from shifting when
  // entering/leaving edit mode — only border + background flip. Width is in
  // `ch` so it hugs the 5-char content; `em` would balloon at 6rem font.
  const sharedBoxStyle: React.CSSProperties = {
    width: '5.5ch',
    padding: '4px 12px',
    boxSizing: 'content-box',
    borderRadius: 8,
    color,
    fontSize: '6rem',
    fontWeight: 700,
    fontFamily: 'var(--font-mono)',
    letterSpacing: '-0.05em',
    textAlign: 'center',
    lineHeight: 1,
    outline: 'none',
  };

  if (editing) {
    return (
      <input
        value={draft}
        onChange={(e) => setDraft((prev) => formatHHMMDraft(e.target.value, prev))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          else if (e.key === 'Escape') setEditing(false);
        }}
        autoFocus
        inputMode="numeric"
        style={{
          ...sharedBoxStyle,
          background: '#050505',
          border: `1px solid ${color}66`,
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (disabled) return;
        setDraft(value);
        setEditing(true);
      }}
      style={{
        ...sharedBoxStyle,
        background: 'transparent',
        border: '1px solid transparent',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {value}
    </button>
  );
}

function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
