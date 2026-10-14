import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { reducer, type Action, type PomodoroSettings, type TimerInstance } from '@/lib/timerState';
import { advanceTimers, restoreTimers, timerStorageKey } from '@/lib/timerStorage';
import { playFocusEndAlarm, playBreakEndAlarm, startLoopingAlarm, stopLoopingAlarm } from '@/lib/timerUtils';

export * from '@/lib/timerState';

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

/** Remount the runtime on account changes so each account owns its saved timers. */
export function TimerProvider({ children, userId }: { children: ReactNode; userId: string }) {
  return <TimerRuntime key={userId} userId={userId}>{children}</TimerRuntime>;
}

function TimerRuntime({ children, userId }: { children: ReactNode; userId: string }) {
  const storageKey = timerStorageKey(userId);
  const [timers, setTimers] = useState(() => {
    let raw: string | null = null;
    try { raw = localStorage.getItem(storageKey); } catch { /* Storage can be unavailable. */ }
    return restoreTimers(raw, Date.now());
  });
  const latest = useRef({ timers, at: Date.now() });

  const update = useCallback((action?: Action) => {
    const now = Date.now();
    const advanced = advanceTimers(latest.current.timers, now - latest.current.at, now);
    const next = action ? reducer(advanced, action) : advanced;
    latest.current = { timers: next, at: now };
    setTimers(next);
    // Save the same timestamp used for advancement. Debouncing with a fresh
    // timestamp would lose the time between the last tick and the write.
    try { localStorage.setItem(storageKey, JSON.stringify({ savedAt: now, timers: next })); } catch { /* Optional storage. */ }
  }, [storageKey]);

  const anyRunning = timers.some((timer) => timer.running);
  useEffect(() => {
    if (!anyRunning) return;
    const id = window.setInterval(() => update(), 100);
    return () => window.clearInterval(id);
  }, [anyRunning, update]);

  useEffect(() => {
    const save = () => {
      const now = Date.now();
      const current = advanceTimers(latest.current.timers, now - latest.current.at, now);
      try { localStorage.setItem(storageKey, JSON.stringify({ savedAt: now, timers: current })); } catch { /* Optional storage. */ }
    };
    const visible = () => {
      if (document.visibilityState === 'visible') update();
      else save();
    };
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', visible);
    return () => {
      save();
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [storageKey, update]);

  const ringing = timers.some((timer) =>
    timer.kind === 'alarm' ? timer.ringing
      : timer.kind === 'pomodoro' ? timer.completed
        : timer.kind === 'countdown' && timer.totalMs > 0 && timer.remainingMs === 0 && timer.zeroedAt !== null,
  );
  useEffect(() => {
    if (ringing) startLoopingAlarm();
    // Stops the interval and closes its audio contexts, including on sign-out.
    return () => stopLoopingAlarm();
  }, [ringing]);

  const previous = useRef(timers);
  useEffect(() => {
    const before = previous.current.find((timer) => timer.kind === 'pomodoro');
    const after = timers.find((timer) => timer.kind === 'pomodoro');
    if (before?.running && after?.running && before.phase !== after.phase) {
      if (after.phase === 'pause') playFocusEndAlarm();
      else playBreakEndAlarm();
    }
    previous.current = timers;
  }, [timers]);

  function getTimer<K extends TimerInstance['kind']>(kind: K): Extract<TimerInstance, { kind: K }> {
    return timers.find((timer) => timer.kind === kind) as Extract<TimerInstance, { kind: K }>;
  }
  const value: TimerContextValue = {
    timers, getTimer,
    setPersistent: (kind, persistent) => update({ type: 'setPersistent', kind, persistent }),
    setColor: (kind, color) => update({ type: 'setColor', kind, color }),
    setCountdownTime: (ms) => update({ type: 'countdown/setTime', ms }),
    setCountdownRunning: (running) => update({ type: 'countdown/setRunning', running, now: Date.now() }),
    resetCountdown: () => update({ type: 'countdown/reset', now: Date.now() }),
    setStopwatchRunning: (running) => update({ type: 'stopwatch/setRunning', running, now: Date.now() }),
    addStopwatchLap: () => update({ type: 'stopwatch/addLap' }),
    resetStopwatch: () => update({ type: 'stopwatch/reset', now: Date.now() }),
    setPomodoroRunning: (running) => update({ type: 'pomodoro/setRunning', running, now: Date.now() }),
    resetPomodoro: () => update({ type: 'pomodoro/reset', now: Date.now() }),
    updatePomodoroSettings: (settings) => update({ type: 'pomodoro/updateSettings', settings }),
    setPomodoroTime: (ms) => update({ type: 'pomodoro/setTime', ms }),
    setAlarmTime: (time) => update({ type: 'alarm/setTime', time }),
    armAlarm: () => update({ type: 'alarm/arm', now: Date.now() }),
    cancelAlarm: () => update({ type: 'alarm/cancel' }),
    stopAlarm: () => update({ type: 'alarm/stop' }),
  };
  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function useTimers(): TimerContextValue {
  const value = useContext(TimerContext);
  if (!value) throw new Error('useTimers must be used within <TimerProvider>');
  return value;
}
