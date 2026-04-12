import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Play, Pause, RotateCcw, Flag, Minus, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { cn } from '@/lib/cn';

/**
 * Timer / Stoppeklokke / Pomodoro page. Three modes share a single
 * circular display so the visual language stays consistent. Each mode
 * has its own state and runs independently — switching tabs does not
 * stop the active mode.
 *
 * - **Timer:** counts down from a chosen duration to zero, alarm at end.
 * - **Stoppeklokke:** counts up, lap times stored on each lap-press.
 * - **Pomodoro:** structured focus/break cycles with auto-advance.
 *
 * Both Timer and Pomodoro support live time adjustments — click the
 * digits to type a new time directly, or use the −5/−1/+1/+5 buttons
 * for quick bumps that work even while the timer is running.
 */
type Mode = 'timer' | 'stopwatch' | 'pomodoro';

export function ToolTimerPage() {
  // Default mode is the first tab in the list (Timer) so the page
  // opens on whichever mode the user sees on the left.
  const [mode, setMode] = useState<Mode>('timer');

  return (
    <div className="page">
      <Link to="/tools" className="tools-back-link tools-back-link-eyebrow">
        ← Verktøy
      </Link>
      <PageHeader
        title="Timer & Pomodoro"
        subtitle="Timer, stoppeklokke og Pomodoro i ett."
      />

      <div className="tt-mode-tabs" role="tablist" aria-label="Modus">
        {(
          [
            { id: 'timer', label: 'Timer' },
            { id: 'stopwatch', label: 'Stoppeklokke' },
            { id: 'pomodoro', label: 'Pomodoro' },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            className={cn('tt-mode-tab', mode === m.id && 'active')}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="surface tt-surface">
        {mode === 'pomodoro' && <PomodoroMode />}
        {mode === 'timer' && <TimerMode />}
        {mode === 'stopwatch' && <StopwatchMode />}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Shared display — circular ring + huge digits in the middle              */
/* ──────────────────────────────────────────────────────────────────────── */

interface RingDisplayProps {
  /** 0–1, fraction of the ring that should be filled. */
  progress: number;
  /** Big content in the middle (string OR a clickable EditableTime). */
  text: ReactNode;
  /** Smaller label above the digits. */
  label?: string;
  /** Hex color used for the progress arc and label. */
  color: string;
}

function RingDisplay({ progress, text, label, color }: RingDisplayProps) {
  // The progress arc is built as an explicit SVG path so we control
  // the sweep direction. It starts at 12 o'clock and sweeps CLOCKWISE
  // — at progress=1 the ring is full, and as time runs out the END of
  // the arc retreats counter-clockwise back toward 12. This matches
  // the standard countdown convention.
  const R = 130;
  const CX = 150;
  const CY = 150;

  return (
    <div className="tt-ring-wrap" style={{ ['--ring-color' as string]: color }}>
      <svg className="tt-ring" viewBox="0 0 300 300" aria-hidden="true">
        <circle
          className="tt-ring-track"
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          strokeWidth="10"
        />
        <path
          className="tt-ring-progress"
          d={buildArcPath(progress, CX, CY, R)}
          fill="none"
          strokeWidth="10"
          stroke={color}
          strokeLinecap="round"
        />
      </svg>
      <div className="tt-ring-center">
        {label && (
          <div className="tt-ring-label" style={{ color }}>
            {label}
          </div>
        )}
        {text}
      </div>
    </div>
  );
}

/**
 * Build an SVG path that draws an arc starting at 12 o'clock and
 * sweeping CLOCKWISE for `progress * 360` degrees. Used by the
 * countdown ring so the depletion looks like a clock hand sweeping
 * around — the visible portion shrinks from the end (returning to
 * the 12 o'clock start point as time hits zero).
 */
function buildArcPath(progress: number, cx: number, cy: number, r: number): string {
  const p = Math.max(0, Math.min(1, progress));
  if (p <= 0) return '';
  // SVG can't draw a complete circle with a single A-command (start
  // and end coincide), so render the full case as two half-arcs.
  if (p >= 0.9999) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r}`;
  }
  const angle = p * 360;
  // Convert to radians, with -90° offset so 0° = 12 o'clock instead
  // of the SVG default of 3 o'clock.
  const endRad = ((angle - 90) * Math.PI) / 180;
  const endX = cx + r * Math.cos(endRad);
  const endY = cy + r * Math.sin(endRad);
  const largeArc = angle > 180 ? 1 : 0;
  return `M ${cx} ${cy - r} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`;
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                  */
/* ──────────────────────────────────────────────────────────────────────── */

function formatHMS(totalSec: number): string {
  totalSec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatStopwatch(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const cs = Math.floor((ms % 1000) / 10); // centiseconds
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/**
 * Parse a free-form time string into milliseconds.
 *   "5"        → 5 minutes  (single number = minutes)
 *   "1:30"     → 1 min 30 sec
 *   "1:30:00"  → 1 hour 30 min
 * Returns null if the input can't be parsed.
 */
function parseTimeString(s: string): number | null {
  s = s.trim();
  if (!s) return null;
  const parts = s.split(':').map((p) => p.trim());
  if (parts.some((p) => p === '' || !/^\d+$/.test(p))) return null;
  const nums = parts.map((p) => parseInt(p, 10));
  let totalSec = 0;
  if (nums.length === 1) {
    totalSec = nums[0] * 60;
  } else if (nums.length === 2) {
    totalSec = nums[0] * 60 + nums[1];
  } else if (nums.length === 3) {
    totalSec = nums[0] * 3600 + nums[1] * 60 + nums[2];
  } else {
    return null;
  }
  if (totalSec < 0 || totalSec > 24 * 3600) return null;
  return totalSec * 1000;
}

/**
 * Play a short two-beep alarm via Web Audio. Avoids needing an audio
 * file in /public — synth-generated tones are good enough for an alarm.
 */
function playAlarm() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const beep = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + start + 0.02);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    };
    beep(880, 0, 0.18);
    beep(1175, 0.22, 0.22);
  } catch {
    /* audio context blocked — fail silently */
  }
}

/** Best-effort browser notification. Requests permission lazily. */
function notify(title: string, body: string) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((perm) => {
      if (perm === 'granted') new Notification(title, { body });
    });
  }
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Editable time — shown in the middle of the ring                          */
/* ──────────────────────────────────────────────────────────────────────── */

function EditableTime({
  ms,
  onChange,
}: {
  ms: number;
  onChange: (newMs: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function start() {
    setDraft(formatHMS(ms / 1000));
    setEditing(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }

  function commit() {
    const parsed = parseTimeString(draft);
    if (parsed !== null) onChange(parsed);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="tt-ring-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            setEditing(false);
          }
        }}
        spellCheck={false}
        inputMode="numeric"
        aria-label="Rediger tid"
      />
    );
  }

  return (
    <button
      type="button"
      className="tt-ring-text tt-ring-text-editable"
      onClick={start}
      title="Klikk for å redigere"
    >
      {formatHMS(ms / 1000)}
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Adjust buttons — −5 / −1 / +1 / +5 minutes                                */
/* ──────────────────────────────────────────────────────────────────────── */

const ADJUST_DELTAS_MS = [-5 * 60_000, -1 * 60_000, 1 * 60_000, 5 * 60_000];

function AdjustButtons({
  onAdjust,
  color,
}: {
  onAdjust: (deltaMs: number) => void;
  color: string;
}) {
  return (
    <div className="tt-adjust-row">
      {ADJUST_DELTAS_MS.map((d) => {
        const minutes = Math.abs(d / 60_000);
        const sign = d > 0 ? '+' : '−';
        return (
          <button
            key={d}
            type="button"
            className="tt-adjust-btn"
            style={{ ['--adjust-color' as string]: color }}
            onClick={() => onAdjust(d)}
            aria-label={`${sign}${minutes} minutter`}
          >
            {d > 0 ? <Plus size={14} /> : <Minus size={14} />}
            {minutes}m
          </button>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Pomodoro mode                                                            */
/* ──────────────────────────────────────────────────────────────────────── */

type PomodoroPhase = 'focus' | 'pause';

interface PomodoroSettings {
  /** Default focus length. Bumped whenever the user edits the ring during a
   *  focus phase, so it persists across sessions. */
  focusMin: number;
  /** Length of every pause phase. */
  pauseMin: number;
  /** How many focus sessions to run before stopping. */
  targetCycles: number;
}

const DEFAULT_POMODORO: PomodoroSettings = {
  focusMin: 25,
  pauseMin: 5,
  targetCycles: 4,
};

const POMODORO_COLORS: Record<PomodoroPhase, string> = {
  focus: '#34d399', // mint-green-ish, vibrant (Tailwind emerald-400)
  pause: '#06b6d4', // cyan, distinctly different from the focus color
};

const POMODORO_LABELS: Record<PomodoroPhase, string> = {
  focus: 'FOKUS',
  pause: 'PAUSE',
};

function PomodoroMode() {
  // New schema (v2): {focusMin, pauseMin, targetCycles}. The raw stored
  // value may be partial (missing fields from an in-flight schema
  // change), so we always merge with DEFAULT_POMODORO before using it.
  // This also recovers from any field that ended up NaN/undefined.
  const [storedSettings, setStoredSettings] = useLocalStorage<Partial<PomodoroSettings>>(
    'tool-pomodoro-settings-v2',
    DEFAULT_POMODORO
  );
  const settings: PomodoroSettings = {
    focusMin: Number.isFinite(storedSettings.focusMin) ? storedSettings.focusMin! : DEFAULT_POMODORO.focusMin,
    pauseMin: Number.isFinite(storedSettings.pauseMin) ? storedSettings.pauseMin! : DEFAULT_POMODORO.pauseMin,
    targetCycles: Number.isFinite(storedSettings.targetCycles) ? storedSettings.targetCycles! : DEFAULT_POMODORO.targetCycles,
  };
  const setSettings = (next: PomodoroSettings) => setStoredSettings(next);
  const [phase, setPhase] = useState<PomodoroPhase>('focus');
  const [cycle, setCycle] = useState(0); // focus sessions completed in this run
  const [running, setRunning] = useState(false);
  const [totalMs, setTotalMs] = useState(settings.focusMin * 60_000);
  const [remainingMs, setRemainingMs] = useState(settings.focusMin * 60_000);

  // Reset countdown when the phase changes (focus → pause or vice versa)
  // or when the user edits the corresponding length in settings.
  useEffect(() => {
    const minutes = phase === 'focus' ? settings.focusMin : settings.pauseMin;
    const ms = minutes * 60_000;
    setTotalMs(ms);
    setRemainingMs(ms);
  }, [phase, settings.focusMin, settings.pauseMin]);

  // Real-elapsed-time tick. Decrements remainingMs by the actual frame
  // delta so external adjustments (edit / +- buttons) can change it
  // mid-tick without breaking the countdown.
  const lastTickRef = useRef(0);
  useEffect(() => {
    if (!running) return;
    lastTickRef.current = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      setRemainingMs((prev) => Math.max(0, prev - delta));
    }, 100);
    return () => window.clearInterval(id);
  }, [running]);

  // Detect "hit zero while running" — auto-advance to next phase, or
  // stop after the user's target number of focus sessions is reached.
  useEffect(() => {
    if (!running || remainingMs > 0) return;
    handlePhaseEnd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, remainingMs]);

  function handlePhaseEnd() {
    playAlarm();
    if (phase === 'focus') {
      const nextCycle = cycle + 1;
      setCycle(nextCycle);
      if (nextCycle >= settings.targetCycles) {
        // All target focus sessions done — stop and reset to a fresh focus.
        notify('Pomodoro ferdig', `${settings.targetCycles} økter fullført.`);
        setRunning(false);
        setPhase('focus');
        setCycle(0);
        return;
      }
      notify('Fokus ferdig', 'Pause starter.');
      setPhase('pause');
    } else {
      notify('Pause over', 'Tilbake til fokus.');
      setPhase('focus');
    }
    // Auto-start next phase via the reset effect above which sets a
    // fresh remainingMs.
  }

  function reset() {
    setRunning(false);
    setPhase('focus');
    setCycle(0);
    setTotalMs(settings.focusMin * 60_000);
    setRemainingMs(settings.focusMin * 60_000);
  }

  function adjust(deltaMs: number) {
    setRemainingMs((prev) => Math.max(0, prev + deltaMs));
    setTotalMs((prev) => Math.max(0, prev + deltaMs));
  }

  /** Editing the ring time updates BOTH the current countdown and the
   *  stored default for whichever phase we're currently in. So clicking
   *  the ring during focus is the canonical way to set focus length. */
  function setExactTime(newMs: number) {
    setRemainingMs(newMs);
    setTotalMs(newMs);
    const minutes = Math.max(1, Math.round(newMs / 60_000));
    if (phase === 'focus') {
      setSettings({ ...settings, focusMin: minutes });
    } else {
      setSettings({ ...settings, pauseMin: minutes });
    }
  }

  const progress = totalMs > 0 ? remainingMs / totalMs : 0;
  const color = POMODORO_COLORS[phase];

  return (
    <div className="tt-mode-body">
      <RingDisplay
        progress={progress}
        text={<EditableTime ms={remainingMs} onChange={setExactTime} />}
        label={POMODORO_LABELS[phase]}
        color={color}
      />

      <AdjustButtons onAdjust={adjust} color={color} />

      {/* Two always-visible setting boxes — focus length is set by
          clicking the ring time, so it doesn't need its own field. */}
      <div className="tt-pomo-boxes">
        <NumberField
          label="Pause (min)"
          value={settings.pauseMin}
          min={1}
          max={60}
          onChange={(v) => setSettings({ ...settings, pauseMin: v })}
        />
        <NumberField
          label="Antall økter"
          value={settings.targetCycles}
          min={1}
          max={20}
          onChange={(v) => setSettings({ ...settings, targetCycles: v })}
        />
      </div>

      <div className="tt-controls">
        <button
          type="button"
          className="tt-btn primary"
          style={{ ['--btn-color' as string]: color }}
          onClick={() => setRunning((r) => !r)}
        >
          {running ? <Pause size={18} /> : <Play size={18} />}
          {running ? 'Pause' : 'Start'}
        </button>
        <button type="button" className="tt-btn" onClick={reset}>
          <RotateCcw size={16} /> Nullstill
        </button>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));
  return (
    <div className="tt-numfield">
      <span className="tt-numfield-label">{label}</span>
      <div className="tt-numfield-stepper">
        <button
          type="button"
          className="tt-numfield-btn"
          onClick={dec}
          disabled={value <= min}
          aria-label={`${label}: redusér`}
        >
          <Minus size={12} />
        </button>
        <span className="tt-numfield-value">{value}</span>
        <button
          type="button"
          className="tt-numfield-btn"
          onClick={inc}
          disabled={value >= max}
          aria-label={`${label}: øk`}
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Timer mode (countdown)                                                   */
/* ──────────────────────────────────────────────────────────────────────── */

const TIMER_COLOR = '#ef4444'; // red — taken from the old Pomodoro focus color
const TIMER_DEFAULT_MS = 5 * 60_000;

function TimerMode() {
  const [totalMs, setTotalMs] = useState(TIMER_DEFAULT_MS);
  const [remainingMs, setRemainingMs] = useState(TIMER_DEFAULT_MS);
  const [running, setRunning] = useState(false);

  // Real-time tick — same approach as Pomodoro.
  const lastTickRef = useRef(0);
  useEffect(() => {
    if (!running) return;
    lastTickRef.current = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      setRemainingMs((prev) => Math.max(0, prev - delta));
    }, 100);
    return () => window.clearInterval(id);
  }, [running]);

  // Fire alarm + stop when we hit zero
  useEffect(() => {
    if (!running || remainingMs > 0) return;
    setRunning(false);
    playAlarm();
    notify('Timer ferdig', `${formatHMS(totalMs / 1000)} er over.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, remainingMs]);

  function adjust(deltaMs: number) {
    setRemainingMs((prev) => Math.max(0, prev + deltaMs));
    setTotalMs((prev) => Math.max(0, prev + deltaMs));
  }

  function setExactTime(newMs: number) {
    setRemainingMs(newMs);
    setTotalMs(newMs);
  }

  function reset() {
    setRunning(false);
    setRemainingMs(totalMs);
  }

  const progress = totalMs > 0 ? remainingMs / totalMs : 0;
  const finished = remainingMs === 0;

  return (
    <div className="tt-mode-body">
      <RingDisplay
        progress={progress}
        text={<EditableTime ms={remainingMs} onChange={setExactTime} />}
        label={finished ? 'FERDIG' : undefined}
        color={TIMER_COLOR}
      />

      <AdjustButtons onAdjust={adjust} color={TIMER_COLOR} />

      <div className="tt-controls">
        <button
          type="button"
          className="tt-btn primary"
          style={{ ['--btn-color' as string]: TIMER_COLOR }}
          onClick={() => setRunning((r) => !r)}
          disabled={remainingMs === 0}
        >
          {running ? <Pause size={18} /> : <Play size={18} />}
          {running ? 'Pause' : 'Start'}
        </button>
        <button type="button" className="tt-btn" onClick={reset}>
          <RotateCcw size={16} /> Nullstill
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Stopwatch mode                                                           */
/* ──────────────────────────────────────────────────────────────────────── */

const STOPWATCH_COLOR = '#22d3ee';

function StopwatchMode() {
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);

  // Tick — high-frequency for smooth centisecond display
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const tick = () => {
      if (startTimeRef.current !== null) {
        setElapsedMs(accumulatedRef.current + (performance.now() - startTimeRef.current));
      }
      raf = requestAnimationFrame(tick);
    };
    startTimeRef.current = performance.now();
    raf = requestAnimationFrame(tick);
    return () => {
      if (startTimeRef.current !== null) {
        accumulatedRef.current += performance.now() - startTimeRef.current;
        startTimeRef.current = null;
      }
      cancelAnimationFrame(raf);
    };
  }, [running]);

  function reset() {
    setRunning(false);
    setElapsedMs(0);
    setLaps([]);
    accumulatedRef.current = 0;
    startTimeRef.current = null;
  }

  function addLap() {
    setLaps((prev) => [elapsedMs, ...prev]);
  }

  return (
    <div className="tt-mode-body">
      <RingDisplay
        // Full ring fill — just decorative since stopwatch counts up
        progress={1}
        text={<div className="tt-ring-text">{formatStopwatch(elapsedMs)}</div>}
        color={STOPWATCH_COLOR}
      />
      <div className="tt-controls">
        <button
          type="button"
          className="tt-btn primary"
          style={{ ['--btn-color' as string]: STOPWATCH_COLOR }}
          onClick={() => setRunning((r) => !r)}
        >
          {running ? <Pause size={18} /> : <Play size={18} />}
          {running ? 'Pause' : elapsedMs > 0 ? 'Fortsett' : 'Start'}
        </button>
        <button type="button" className="tt-btn" onClick={addLap} disabled={!running}>
          <Flag size={16} /> Lap
        </button>
        <button type="button" className="tt-btn" onClick={reset} disabled={elapsedMs === 0 && laps.length === 0}>
          <RotateCcw size={16} /> Nullstill
        </button>
      </div>
      {laps.length > 0 && (
        <div className="tt-lap-list">
          {laps.map((lap, i) => {
            const lapIndex = laps.length - i;
            const prev = laps[i + 1] ?? 0;
            const diff = lap - prev;
            return (
              <div key={i} className="tt-lap-row">
                <span className="tt-lap-num">#{String(lapIndex).padStart(2, '0')}</span>
                <span className="tt-lap-diff">+{formatStopwatch(diff)}</span>
                <span className="tt-lap-time">{formatStopwatch(lap)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
