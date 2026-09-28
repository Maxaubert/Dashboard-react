import { clamp, makeDefaults, reducer, type TimerInstance } from './timerState';

export const timerStorageKey = (userId: string) => `home-timers-v6:${encodeURIComponent(userId)}`;

/** Replay wall time, including every Pomodoro phase crossed while asleep or closed. */
export function advanceTimers(timers: TimerInstance[], elapsed: number, now: number): TimerInstance[] {
  const delta = Math.max(0, elapsed);
  return timers.map((timer) => {
    if (!timer.running) return timer;
    if (timer.kind === 'alarm') return reducer([timer], { type: 'alarm/tick', now })[0];
    if (timer.kind === 'countdown') {
      return reducer([timer], { type: 'countdown/tick', delta, now: now - Math.max(0, delta - timer.remainingMs) })[0];
    }
    if (timer.kind === 'stopwatch') return reducer([timer], { type: 'stopwatch/tick', delta })[0];
    let current = timer;
    let remaining = delta;
    // At most 12 focus sessions and 11 breaks, bounded by validated settings.
    while (current.running && remaining >= current.remainingMs) {
      remaining -= current.remainingMs;
      current = reducer([current], { type: 'pomodoro/advancePhase', now: now - remaining })[0] as typeof current;
    }
    return current.running ? { ...current, remainingMs: current.remainingMs - remaining } : current;
  });
}

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const number = (value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.min(value, max) : fallback;
const nullableNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const clockTime = (value: unknown, fallback: string) =>
  typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback;

export function restoreTimers(raw: string | null, now: number): TimerInstance[] {
  const defaults = makeDefaults();
  if (!raw) return defaults;
  try {
    const snapshot: unknown = JSON.parse(raw);
    if (!record(snapshot) || !Array.isArray(snapshot.timers)) return defaults;
    const savedAt = number(snapshot.savedAt, now);
    const stored = snapshot.timers;
    const timers = defaults.map((timer): TimerInstance => {
      const found: unknown = stored.find((item: unknown) => record(item) && item.kind === timer.kind);
      if (!record(found)) return timer;
      const common = {
        color: typeof found.color === 'string' && /^#[\da-f]{3,8}$/i.test(found.color) ? found.color : timer.color,
        persistent: found.persistent === true,
        running: found.running === true,
        startedAt: nullableNumber(found.startedAt),
        zeroedAt: nullableNumber(found.zeroedAt),
      };
      if (timer.kind === 'stopwatch') {
        return {
          ...timer, ...common,
          elapsedMs: number(found.elapsedMs, 0),
          laps: Array.isArray(found.laps)
            ? found.laps.filter((lap): lap is number => typeof lap === 'number' && Number.isFinite(lap) && lap >= 0).slice(0, 1000)
            : [],
        };
      }
      if (timer.kind === 'alarm') {
        const fireAt = nullableNumber(found.fireAt);
        const ringing = found.ringing === true;
        return {
          ...timer, ...common, fireAt, ringing,
          running: common.running && fireAt !== null && !ringing,
          targetTime: clockTime(found.targetTime, timer.targetTime),
          lastSetTime: clockTime(found.lastSetTime, timer.lastSetTime),
        };
      }
      const totalMs = number(found.totalMs, timer.totalMs, 86_400_000);
      const remainingMs = number(found.remainingMs, totalMs, totalMs);
      if (timer.kind === 'countdown') return { ...timer, ...common, totalMs, remainingMs };
      const settings = record(found.settings) ? found.settings : {};
      const targetCycles = clamp(number(settings.targetCycles, 4), 1, 12);
      const completed = found.completed === true;
      return {
        ...timer, ...common,
        totalMs: Math.max(1000, totalMs), remainingMs,
        settings: {
          focusMin: clamp(number(settings.focusMin, 25), 1, 180),
          pauseMin: clamp(number(settings.pauseMin, 5), 1, 60),
          targetCycles,
        },
        phase: found.phase === 'pause' ? 'pause' : 'focus',
        cycle: clamp(number(found.cycle, 0), 0, targetCycles - 1),
        focusOverrideMs: found.focusOverrideMs == null ? null : clamp(number(found.focusOverrideMs, 1000), 1000, 86_400_000),
        pauseOverrideMs: found.pauseOverrideMs == null ? null : clamp(number(found.pauseOverrideMs, 1000), 1000, 86_400_000),
        completed, running: common.running && !completed,
      };
    });
    return advanceTimers(timers, now - savedAt, now);
  } catch {
    return defaults;
  }
}
