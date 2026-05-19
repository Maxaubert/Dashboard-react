import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import {
  playFocusEndAlarm,
  playBreakEndAlarm,
  startLoopingAlarm,
  stopLoopingAlarm,
} from '@/lib/timerUtils';

/* ── Types ──────────────────────────────────────────────────────────── */

export interface BaseTimer {
  id: string;
  kind: 'countdown' | 'stopwatch' | 'pomodoro' | 'alarm';
  color: string;
  /** User manually added a widget for this timer — stays past zero. */
  persistent: boolean;
}

export interface CountdownTimer extends BaseTimer {
  kind: 'countdown';
  totalMs: number;
  remainingMs: number;
  running: boolean;
  /** performance.now() when the current run started; null if paused. */
  startedAt: number | null;
  /** Date.now() when remainingMs first hit 0. Used for the 60s-to-hide rule. */
  zeroedAt: number | null;
}

export interface StopwatchTimer extends BaseTimer {
  kind: 'stopwatch';
  elapsedMs: number;
  laps: number[];
  running: boolean;
  startedAt: number | null;
  zeroedAt: number | null;
}

export interface PomodoroSettings {
  focusMin: number;
  pauseMin: number;
  targetCycles: number;
}

export interface PomodoroTimer extends BaseTimer {
  kind: 'pomodoro';
  settings: PomodoroSettings;
  phase: 'focus' | 'pause';
  cycle: number;
  totalMs: number;
  remainingMs: number;
  running: boolean;
  startedAt: number | null;
  zeroedAt: number | null;
  /** Overrides for custom clock-input durations; persist across cycles and reset.
   *  Cleared only when the corresponding setting is changed via the settings box
   *  (handled in pomodoro/updateSettings). */
  focusOverrideMs: number | null;
  pauseOverrideMs: number | null;
  /** True from the moment the final focus session ends until the user dismisses
   *  the completion popup. Drives the looping chime and auto-open behavior. */
  completed: boolean;
}

export interface AlarmTimer extends BaseTimer {
  kind: 'alarm';
  /** HH:MM (24h) currently shown. Always present — defaults to lastSetTime. */
  targetTime: string;
  /** HH:MM the user most recently armed. Survives cancel/disarm. */
  lastSetTime: string;
  /** Absolute epoch ms when this alarm should fire. Null when unarmed. */
  fireAt: number | null;
  /** True between fireAt being reached and STOP being clicked. */
  ringing: boolean;
  /** Reused as "armed and counting down" so the ticker knows to dispatch alarm/tick. */
  running: boolean;
  startedAt: number | null;
  zeroedAt: number | null;
}

export type TimerInstance = CountdownTimer | StopwatchTimer | PomodoroTimer | AlarmTimer;

/* ── Defaults ───────────────────────────────────────────────────────── */

export const POMODORO_MINUTE_MS = 60_000;

const DEFAULT_POMODORO: PomodoroSettings = { focusMin: 25, pauseMin: 5, targetCycles: 4 };

export function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export const ALARM_DEFAULT_TIME = '12:30';

/**
 * Given an HH:MM (24h) target and a current epoch ms `now`, return the absolute
 * epoch ms when the alarm should fire. If the wall-clock time is in the past
 * (or equal to the current minute), schedule for tomorrow.
 *
 * Throws if `targetTime` isn't a valid HH:MM in 00:00–23:59.
 *
 * DST note: the returned timestamp is the next occurrence of `HH:MM` in local
 * wall-clock time. Crossing a DST boundary therefore preserves wall-clock
 * meaning (the alarm rings at "07:00" the next morning even if a spring-forward
 * happened overnight) at the cost of the actual elapsed-ms gap shifting by ±1h.
 */
export function computeFireAt(targetTime: string, now: number): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(targetTime.trim());
  if (!m) throw new Error(`computeFireAt: invalid HH:MM ${JSON.stringify(targetTime)}`);
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) {
    throw new Error(`computeFireAt: out-of-range HH:MM ${JSON.stringify(targetTime)}`);
  }
  const target = new Date(now);
  target.setHours(h, min, 0, 0);
  if (target.getTime() <= now) target.setDate(target.getDate() + 1);
  return target.getTime();
}

export function makeDefaults(): TimerInstance[] {
  return [
    {
      id: 'countdown', kind: 'countdown', color: '#ef4444', persistent: false,
      totalMs: 5 * 60_000, remainingMs: 5 * 60_000, running: false, startedAt: null, zeroedAt: null,
    },
    {
      id: 'stopwatch', kind: 'stopwatch', color: '#22d3ee', persistent: false,
      elapsedMs: 0, laps: [], running: false, startedAt: null, zeroedAt: null,
    },
    {
      id: 'pomodoro', kind: 'pomodoro', color: '#34d399', persistent: false,
      settings: { ...DEFAULT_POMODORO },
      phase: 'focus', cycle: 0,
      totalMs: DEFAULT_POMODORO.focusMin * POMODORO_MINUTE_MS, remainingMs: DEFAULT_POMODORO.focusMin * POMODORO_MINUTE_MS,
      running: false, startedAt: null, zeroedAt: null,
      focusOverrideMs: null, pauseOverrideMs: null,
      completed: false,
    },
    {
      id: 'alarm', kind: 'alarm', color: '#f97316', persistent: false,
      targetTime: ALARM_DEFAULT_TIME,
      lastSetTime: ALARM_DEFAULT_TIME,
      fireAt: null,
      ringing: false,
      running: false, startedAt: null, zeroedAt: null,
    },
  ];
}

/* ── Actions ────────────────────────────────────────────────────────── */

export type Action =
  | { type: 'load'; timers: TimerInstance[] }
  | { type: 'setPersistent'; kind: TimerInstance['kind']; persistent: boolean }
  | { type: 'setColor'; kind: TimerInstance['kind']; color: string }
  | { type: 'countdown/setTime'; ms: number }
  | { type: 'countdown/setRunning'; running: boolean; now: number }
  | { type: 'countdown/tick'; delta: number; now: number }
  | { type: 'countdown/reset'; now: number }
  | { type: 'stopwatch/setRunning'; running: boolean; now: number }
  | { type: 'stopwatch/tick'; delta: number }
  | { type: 'stopwatch/addLap' }
  | { type: 'stopwatch/reset'; now: number }
  | { type: 'pomodoro/setRunning'; running: boolean; now: number }
  | { type: 'pomodoro/tick'; delta: number; now: number }
  | { type: 'pomodoro/reset'; now: number }
  | { type: 'pomodoro/advancePhase'; now: number }
  | { type: 'pomodoro/updateSettings'; settings: PomodoroSettings }
  | { type: 'pomodoro/setTime'; ms: number }
  | { type: 'alarm/setTime'; time: string }
  | { type: 'alarm/arm'; now: number }
  | { type: 'alarm/cancel' }
  | { type: 'alarm/tick'; now: number }
  | { type: 'alarm/stop' };

export function reducer(state: TimerInstance[], action: Action): TimerInstance[] {
  return state.map((t) => applyAction(t, action));
}

function applyAction(t: TimerInstance, a: Action): TimerInstance {
  if (a.type === 'load') return a.timers.find((nt) => nt.kind === t.kind) ?? t;
  if (a.type === 'setPersistent' && a.kind === t.kind) return { ...t, persistent: a.persistent };
  if (a.type === 'setColor' && a.kind === t.kind) return { ...t, color: a.color };

  if (t.kind === 'countdown') return reduceCountdown(t, a);
  if (t.kind === 'stopwatch') return reduceStopwatch(t, a);
  if (t.kind === 'pomodoro') return reducePomodoro(t, a);
  if (t.kind === 'alarm') return reduceAlarm(t, a);
  return t;
}

function reduceCountdown(t: CountdownTimer, a: Action): CountdownTimer {
  switch (a.type) {
    case 'countdown/setTime':
      return { ...t, totalMs: a.ms, remainingMs: a.ms, zeroedAt: null };
    case 'countdown/setRunning':
      if (a.running && t.remainingMs === 0) return t;
      return { ...t, running: a.running, startedAt: a.running ? a.now : null };
    case 'countdown/tick': {
      if (!t.running) return t;
      const next = Math.max(0, t.remainingMs - a.delta);
      const zeroedAt = next === 0 && t.zeroedAt === null ? Date.now() : t.zeroedAt;
      const running = next === 0 ? false : t.running;
      return { ...t, remainingMs: next, running, zeroedAt, startedAt: running ? t.startedAt : null };
    }
    case 'countdown/reset':
      return { ...t, remainingMs: t.totalMs, running: false, startedAt: null, zeroedAt: Date.now() };
    default:
      return t;
  }
}

function reduceStopwatch(t: StopwatchTimer, a: Action): StopwatchTimer {
  switch (a.type) {
    case 'stopwatch/setRunning':
      return { ...t, running: a.running, startedAt: a.running ? a.now : null, zeroedAt: null };
    case 'stopwatch/tick':
      if (!t.running) return t;
      return { ...t, elapsedMs: t.elapsedMs + a.delta };
    case 'stopwatch/addLap':
      return { ...t, laps: [t.elapsedMs, ...t.laps] };
    case 'stopwatch/reset':
      return { ...t, elapsedMs: 0, laps: [], running: false, startedAt: null, zeroedAt: Date.now() };
    default:
      return t;
  }
}

function reducePomodoro(t: PomodoroTimer, a: Action): PomodoroTimer {
  switch (a.type) {
    case 'pomodoro/setRunning':
      return {
        ...t,
        running: a.running,
        startedAt: a.running ? a.now : null,
        completed: a.running ? false : t.completed,
      };
    case 'pomodoro/tick': {
      if (!t.running) return t;
      const next = Math.max(0, t.remainingMs - a.delta);
      if (next > 0) return { ...t, remainingMs: next };
      return { ...t, remainingMs: 0, running: false, startedAt: null, zeroedAt: t.zeroedAt ?? Date.now() };
    }
    case 'pomodoro/advancePhase': {
      if (t.phase === 'focus') {
        const nextCycle = t.cycle + 1;
        const pauseMs = t.pauseOverrideMs ?? t.settings.pauseMin * POMODORO_MINUTE_MS;
        const focusMs = t.focusOverrideMs ?? t.settings.focusMin * POMODORO_MINUTE_MS;
        if (nextCycle >= t.settings.targetCycles) {
          return {
            ...t, phase: 'focus', cycle: 0,
            totalMs: focusMs,
            remainingMs: focusMs,
            running: false, startedAt: null, zeroedAt: Date.now(),
            completed: true,
          };
        }
        return {
          ...t, phase: 'pause', cycle: nextCycle,
          totalMs: pauseMs,
          remainingMs: pauseMs,
          running: true, startedAt: a.now, zeroedAt: null,
        };
      } else {
        const focusMs = t.focusOverrideMs ?? t.settings.focusMin * POMODORO_MINUTE_MS;
        return {
          ...t, phase: 'focus',
          totalMs: focusMs,
          remainingMs: focusMs,
          running: true, startedAt: a.now, zeroedAt: null,
        };
      }
    }
    case 'pomodoro/reset': {
      // Reset returns to the start of the cycle but PRESERVES the user's
      // clock-input override (focusOverrideMs / pauseOverrideMs). The override is
      // only cleared when the corresponding setting is changed via the inline
      // settings box (handled in pomodoro/updateSettings).
      const focusMs = t.focusOverrideMs ?? t.settings.focusMin * POMODORO_MINUTE_MS;
      return {
        ...t, phase: 'focus', cycle: 0,
        totalMs: focusMs,
        remainingMs: focusMs,
        running: false, startedAt: null, zeroedAt: Date.now(),
        completed: false,
      };
    }
    case 'pomodoro/updateSettings': {
      // Clamp each setting to a sane range so we don't render 100k ring
      // segments or start a 9999-minute focus by accident.
      const clamped: PomodoroSettings = {
        focusMin: clamp(a.settings.focusMin, 1, 180),
        pauseMin: clamp(a.settings.pauseMin, 1, 60),
        targetCycles: clamp(a.settings.targetCycles, 1, 12),
      };
      const focusChanged = clamped.focusMin !== t.settings.focusMin;
      const pauseChanged = clamped.pauseMin !== t.settings.pauseMin;
      const baseMs = (t.phase === 'focus' ? clamped.focusMin : clamped.pauseMin) * POMODORO_MINUTE_MS;
      const shouldReset = !t.running;
      return {
        ...t, settings: clamped,
        totalMs: shouldReset ? baseMs : t.totalMs,
        remainingMs: shouldReset ? baseMs : t.remainingMs,
        focusOverrideMs: focusChanged ? null : t.focusOverrideMs,
        pauseOverrideMs: pauseChanged ? null : t.pauseOverrideMs,
      };
    }
    case 'pomodoro/setTime': {
      // Direct ms override from clicking the clock face. Persists across
      // phase transitions via focusOverrideMs / pauseOverrideMs — so a
      // custom "30s" focus keeps being 30s on the next session.
      return {
        ...t,
        totalMs: a.ms,
        remainingMs: a.ms,
        zeroedAt: null,
        focusOverrideMs: t.phase === 'focus' ? a.ms : t.focusOverrideMs,
        pauseOverrideMs: t.phase === 'pause' ? a.ms : t.pauseOverrideMs,
      };
    }
    default:
      return t;
  }
}

function reduceAlarm(t: AlarmTimer, a: Action): AlarmTimer {
  switch (a.type) {
    case 'alarm/setTime':
      return { ...t, targetTime: a.time };
    case 'alarm/arm': {
      const fireAt = computeFireAt(t.targetTime, a.now);
      return {
        ...t,
        fireAt,
        running: true,
        startedAt: a.now,
        zeroedAt: null,
        ringing: false,
        lastSetTime: t.targetTime,
      };
    }
    case 'alarm/cancel':
      return { ...t, fireAt: null, running: false, startedAt: null, ringing: false };
    case 'alarm/tick': {
      if (!t.running || t.fireAt === null) return t;
      if (a.now < t.fireAt) return t;
      return {
        ...t,
        ringing: true,
        running: false,
        startedAt: null,
        fireAt: null,
        zeroedAt: a.now,
      };
    }
    case 'alarm/stop':
      return { ...t, ringing: false, running: false, startedAt: null, fireAt: null };
    default:
      return t;
  }
}

/* ── Context ────────────────────────────────────────────────────────── */

export interface TimerContextValue {
  timers: TimerInstance[];
  getTimer<K extends TimerInstance['kind']>(kind: K): Extract<TimerInstance, { kind: K }>;

  setPersistent(kind: TimerInstance['kind'], persistent: boolean): void;
  setColor(kind: TimerInstance['kind'], color: string): void;

  setCountdownTime(ms: number): void;
  setCountdownRunning(running: boolean): void;
  resetCountdown(): void;

  setStopwatchRunning(running: boolean): void;
  addStopwatchLap(): void;
  resetStopwatch(): void;

  setPomodoroRunning(running: boolean): void;
  resetPomodoro(): void;
  updatePomodoroSettings(settings: PomodoroSettings): void;
  setPomodoroTime(ms: number): void;

  setAlarmTime(time: string): void;
  armAlarm(): void;
  cancelAlarm(): void;
  stopAlarm(): void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

const STORAGE_KEY = 'home-timers-v5';
const LEGACY_STORAGE_KEY = 'home-timers-v4';

interface PersistedTimers {
  /** Date.now() at the moment the snapshot was written. Used on restore
   *  to replay the wall-clock elapsed time across the reload so running
   *  timers don't freeze while the tab is closed. */
  savedAt: number;
  timers: TimerInstance[];
}

/**
 * Take a timers array and a wall-clock delta (ms since it was saved) and
 * advance running timers by that delta so refresh is transparent.
 */
function advanceAcrossReload(timers: TimerInstance[], elapsed: number): TimerInstance[] {
  if (elapsed <= 0) return timers;
  return timers.map((t) => {
    if (t.kind === 'countdown') {
      if (!t.running) return t;
      const nextRem = Math.max(0, t.remainingMs - elapsed);
      return {
        ...t,
        remainingMs: nextRem,
        running: nextRem > 0,
        startedAt: null, // ticker resets this on mount
        zeroedAt: nextRem === 0 && t.zeroedAt === null ? Date.now() : t.zeroedAt,
      };
    }
    if (t.kind === 'stopwatch') {
      if (!t.running) return t;
      return {
        ...t,
        elapsedMs: t.elapsedMs + elapsed,
        running: true,
        startedAt: null,
      };
    }
    if (t.kind === 'pomodoro') {
      if (!t.running) return t;
      // Pomodoro phase flips happen in a React effect (not in the reducer),
      // so rather than replay multiple phase crossings here we just cap
      // remainingMs at 0 on overshoot — the effect will advance the phase
      // on the next tick. Good enough; worst case the user loses ~a second
      // on the boundary.
      const nextRem = Math.max(0, t.remainingMs - elapsed);
      return {
        ...t,
        remainingMs: nextRem,
        running: nextRem > 0,
        startedAt: null,
        zeroedAt: nextRem === 0 && t.zeroedAt === null ? Date.now() : t.zeroedAt,
      };
    }
    if (t.kind === 'alarm') {
      // fireAt is absolute epoch-ms so it survives reload as-is. The
      // ticker will re-check it against Date.now() on the next tick.
      return t;
    }
    return t;
  });
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const [timers, dispatch] = useReducer(reducer, undefined, () => {
    try {
      let snapshot: PersistedTimers | null = null;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        snapshot = JSON.parse(raw) as PersistedTimers;
      } else {
        // One-time migration from the old flat-array format (v4).
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy) {
          snapshot = { savedAt: Date.now(), timers: JSON.parse(legacy) };
        }
      }
      if (!snapshot) return makeDefaults();
      const elapsed = Math.max(0, Date.now() - snapshot.savedAt);
      const defaults = makeDefaults();
      // Merge: for each kind in defaults, prefer parsed if present.
      const merged = defaults.map((d) => {
        const found = snapshot!.timers.find((p) => p.kind === d.kind);
        if (!found) return d;
        if (found.kind === 'pomodoro') {
          // Defensive clamp on load — older versions allowed any integer.
          return {
            ...found,
            settings: {
              focusMin: clamp(found.settings?.focusMin ?? 25, 1, 180),
              pauseMin: clamp(found.settings?.pauseMin ?? 5, 1, 60),
              targetCycles: clamp(found.settings?.targetCycles ?? 4, 1, 12),
            },
          } as TimerInstance;
        }
        return found;
      });
      return advanceAcrossReload(merged, elapsed);
    } catch {
      return makeDefaults();
    }
  });

  const saveTimeoutRef = useRef<number | undefined>(undefined);
  const timersRef = useRef(timers);
  timersRef.current = timers;

  function flushSave() {
    try {
      const snapshot: PersistedTimers = { savedAt: Date.now(), timers: timersRef.current };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch { /* ignore */ }
  }

  useEffect(() => {
    window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(flushSave, 200);
    return () => window.clearTimeout(saveTimeoutRef.current);
    // flushSave is stable (uses refs) so deps can stay on `timers`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timers]);

  // Flush on tab-close so the debounced save doesn't get dropped when the
  // user hits refresh within 200ms of the last tick. pagehide is the
  // cross-browser-safe hook (beforeunload fires inconsistently on mobile).
  useEffect(() => {
    const handler = () => flushSave();
    window.addEventListener('pagehide', handler);
    window.addEventListener('visibilitychange', handler);
    return () => {
      window.removeEventListener('pagehide', handler);
      window.removeEventListener('visibilitychange', handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getTimer<K extends TimerInstance['kind']>(kind: K): Extract<TimerInstance, { kind: K }> {
    return timers.find((t) => t.kind === kind) as Extract<TimerInstance, { kind: K }>;
  }

  // ── Ticker: 100ms interval — decrements running countdown/pomodoro, increments stopwatch ──
  const lastTickRef = useRef(performance.now());
  useEffect(() => {
    const anyRunning = timers.some((t) => t.running);
    if (!anyRunning) {
      lastTickRef.current = performance.now();
      return;
    }
    lastTickRef.current = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      for (const t of timers) {
        if (!t.running) continue;
        if (t.kind === 'countdown') dispatch({ type: 'countdown/tick', delta, now });
        else if (t.kind === 'stopwatch') dispatch({ type: 'stopwatch/tick', delta });
        else if (t.kind === 'pomodoro') dispatch({ type: 'pomodoro/tick', delta, now });
        else if (t.kind === 'alarm') dispatch({ type: 'alarm/tick', now: Date.now() });
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [timers]);

  // ── Alarms and pomodoro phase auto-advance on zero crossing ──
  const prevRef = useRef<TimerInstance[]>(timers);
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = timers;

    for (const t of timers) {
      const p = prev.find((pp) => pp.id === t.id);
      if (!p) continue;

      // Countdown hit zero this tick
      if (t.kind === 'countdown' && p.kind === 'countdown') {
        // Start looping chime when remainingMs hits 0; stop when reset away from 0.
        if (p.remainingMs > 0 && t.remainingMs === 0) {
          startLoopingAlarm();
        }
        if (p.remainingMs === 0 && t.remainingMs > 0) {
          stopLoopingAlarm();
        }
      }

      // Pomodoro phase end — different alarm for focus→break vs break→focus
      if (t.kind === 'pomodoro' && p.kind === 'pomodoro') {
        if (p.remainingMs > 0 && t.remainingMs === 0) {
          // At this point t.phase still holds the OLD phase (advancePhase hasn't dispatched yet).
          const isFinalFocusEnd = t.phase === 'focus' && (t.cycle + 1 >= t.settings.targetCycles);
          if (isFinalFocusEnd) {
            // The advancePhase dispatch below will set completed=true and reset to a fresh state.
            // Start the looping chime now; it stops when the user dismisses (resetPomodoro
            // → completed flips false → the branch below catches the falling edge).
            startLoopingAlarm();
          } else if (t.phase === 'focus') {
            playFocusEndAlarm();
          } else {
            playBreakEndAlarm();
          }
          dispatch({ type: 'pomodoro/advancePhase', now: performance.now() });
        }
        // Stop the looping chime when pomodoro leaves completed state
        // (via resetPomodoro from the popup-close handler, or via setRunning(true)).
        if (p.completed && !t.completed) {
          stopLoopingAlarm();
        }
      }

      // Alarm started ringing this tick → start the looping chime; cleared → stop it
      if (t.kind === 'alarm' && p.kind === 'alarm') {
        if (!p.ringing && t.ringing) {
          startLoopingAlarm();
        }
        if (p.ringing && !t.ringing) {
          stopLoopingAlarm();
        }
      }
    }
  }, [timers]);

  // Unmount safety: if the provider unmounts while an alarm is ringing, the
  // looping chime would otherwise keep playing with no React handle to stop it.
  useEffect(() => {
    return () => stopLoopingAlarm();
  }, []);

  const value: TimerContextValue = {
    timers,
    getTimer,
    setPersistent: (kind, persistent) => dispatch({ type: 'setPersistent', kind, persistent }),
    setColor: (kind, color) => dispatch({ type: 'setColor', kind, color }),
    setCountdownTime: (ms) => dispatch({ type: 'countdown/setTime', ms }),
    setCountdownRunning: (running) => dispatch({ type: 'countdown/setRunning', running, now: performance.now() }),
    resetCountdown: () => dispatch({ type: 'countdown/reset', now: performance.now() }),
    setStopwatchRunning: (running) => dispatch({ type: 'stopwatch/setRunning', running, now: performance.now() }),
    addStopwatchLap: () => dispatch({ type: 'stopwatch/addLap' }),
    resetStopwatch: () => dispatch({ type: 'stopwatch/reset', now: performance.now() }),
    setPomodoroRunning: (running) => dispatch({ type: 'pomodoro/setRunning', running, now: performance.now() }),
    resetPomodoro: () => dispatch({ type: 'pomodoro/reset', now: performance.now() }),
    updatePomodoroSettings: (settings) => dispatch({ type: 'pomodoro/updateSettings', settings }),
    setPomodoroTime: (ms) => dispatch({ type: 'pomodoro/setTime', ms }),
    setAlarmTime: (time) => dispatch({ type: 'alarm/setTime', time }),
    armAlarm: () => dispatch({ type: 'alarm/arm', now: Date.now() }),
    cancelAlarm: () => dispatch({ type: 'alarm/cancel' }),
    stopAlarm: () => dispatch({ type: 'alarm/stop' }),
  };

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function useTimers(): TimerContextValue {
  const v = useContext(TimerContext);
  if (!v) throw new Error('useTimers must be used within <TimerProvider>');
  return v;
}
