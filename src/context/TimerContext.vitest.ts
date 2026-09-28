import { describe, it, expect } from 'vitest';
import {
  reducer,
  makeDefaults,
  clamp,
  computeFireAt,
  type PomodoroTimer,
  type CountdownTimer,
  type StopwatchTimer,
  type TimerInstance,
} from './TimerContext';

/** Narrow the tuple returned by reducer() back to a specific kind. */
function get<K extends TimerInstance['kind']>(state: TimerInstance[], kind: K): Extract<TimerInstance, { kind: K }> {
  return state.find((t) => t.kind === kind) as Extract<TimerInstance, { kind: K }>;
}

describe('clamp', () => {
  it('clamps to min when below', () => expect(clamp(-5, 1, 10)).toBe(1));
  it('clamps to max when above', () => expect(clamp(99, 1, 10)).toBe(10));
  it('rounds fractional to nearest int', () => expect(clamp(3.7, 1, 10)).toBe(4));
  it('falls back to min for NaN', () => expect(clamp(NaN, 1, 10)).toBe(1));
  it('falls back to min for Infinity', () => expect(clamp(Infinity, 1, 10)).toBe(1));
});

describe('countdown reducer', () => {
  it('setTime resets totalMs and remainingMs together', () => {
    const s = reducer(makeDefaults(), { type: 'countdown/setTime', ms: 60_000 });
    const c = get(s, 'countdown');
    expect(c.totalMs).toBe(60_000);
    expect(c.remainingMs).toBe(60_000);
    expect(c.zeroedAt).toBeNull();
  });

  it('refuses to start when already at zero', () => {
    let s = reducer(makeDefaults(), { type: 'countdown/setTime', ms: 0 });
    s = reducer(s, { type: 'countdown/setRunning', running: true, now: 0 });
    expect(get(s, 'countdown').running).toBe(false);
  });

  it('tick decrements remainingMs and stops at zero', () => {
    let s = reducer(makeDefaults(), { type: 'countdown/setTime', ms: 1000 });
    s = reducer(s, { type: 'countdown/setRunning', running: true, now: 0 });
    s = reducer(s, { type: 'countdown/tick', delta: 1500, now: 1500 });
    const c = get(s, 'countdown');
    expect(c.remainingMs).toBe(0);
    expect(c.running).toBe(false);
    expect(c.zeroedAt).not.toBeNull();
  });

  it('reset restores totalMs without touching settings', () => {
    let s = reducer(makeDefaults(), { type: 'countdown/setTime', ms: 5000 });
    s = reducer(s, { type: 'countdown/setRunning', running: true, now: 0 });
    s = reducer(s, { type: 'countdown/tick', delta: 2000, now: 2000 });
    s = reducer(s, { type: 'countdown/reset', now: 5000 });
    const c = get(s, 'countdown');
    expect(c.remainingMs).toBe(5000);
    expect(c.running).toBe(false);
  });
});

describe('stopwatch reducer', () => {
  it('tick increments when running', () => {
    let s = reducer(makeDefaults(), { type: 'stopwatch/setRunning', running: true, now: 0 });
    s = reducer(s, { type: 'stopwatch/tick', delta: 250 });
    s = reducer(s, { type: 'stopwatch/tick', delta: 250 });
    expect(get(s, 'stopwatch').elapsedMs).toBe(500);
  });

  it('tick is ignored when paused', () => {
    const s = reducer(makeDefaults(), { type: 'stopwatch/tick', delta: 500 });
    expect(get(s, 'stopwatch').elapsedMs).toBe(0);
  });

  it('addLap prepends current elapsedMs', () => {
    let s = reducer(makeDefaults(), { type: 'stopwatch/setRunning', running: true, now: 0 });
    s = reducer(s, { type: 'stopwatch/tick', delta: 1000 });
    s = reducer(s, { type: 'stopwatch/addLap' });
    s = reducer(s, { type: 'stopwatch/tick', delta: 500 });
    s = reducer(s, { type: 'stopwatch/addLap' });
    expect(get(s, 'stopwatch').laps).toEqual([1500, 1000]);
  });

  it('reset zeroes elapsed and clears laps', () => {
    let s = reducer(makeDefaults(), { type: 'stopwatch/setRunning', running: true, now: 0 });
    s = reducer(s, { type: 'stopwatch/tick', delta: 1000 });
    s = reducer(s, { type: 'stopwatch/reset', now: 1000 });
    const sw = get(s, 'stopwatch');
    expect(sw.elapsedMs).toBe(0);
    expect(sw.laps).toEqual([]);
    expect(sw.running).toBe(false);
  });
});

describe('pomodoro reducer', () => {
  it('updateSettings clamps targetCycles to [1,12]', () => {
    const s = reducer(makeDefaults(), {
      type: 'pomodoro/updateSettings',
      settings: { focusMin: 25, pauseMin: 5, targetCycles: 100_000 },
    });
    expect(get(s, 'pomodoro').settings.targetCycles).toBe(12);
  });

  it('updateSettings clamps focusMin to [1,180] and pauseMin to [1,60]', () => {
    const s = reducer(makeDefaults(), {
      type: 'pomodoro/updateSettings',
      settings: { focusMin: 9999, pauseMin: 9999, targetCycles: 4 },
    });
    const p = get(s, 'pomodoro');
    expect(p.settings.focusMin).toBe(180);
    expect(p.settings.pauseMin).toBe(60);
  });

  it('updateSettings clamps negative to 1', () => {
    const s = reducer(makeDefaults(), {
      type: 'pomodoro/updateSettings',
      settings: { focusMin: -5, pauseMin: 0, targetCycles: 0 },
    });
    const p = get(s, 'pomodoro');
    expect(p.settings.focusMin).toBe(1);
    expect(p.settings.pauseMin).toBe(1);
    expect(p.settings.targetCycles).toBe(1);
  });

  it('changing focusMin clears focusOverrideMs', () => {
    let s = reducer(makeDefaults(), { type: 'pomodoro/setTime', ms: 30_000 });
    expect(get(s, 'pomodoro').focusOverrideMs).toBe(30_000);
    s = reducer(s, {
      type: 'pomodoro/updateSettings',
      settings: { focusMin: 30, pauseMin: 5, targetCycles: 4 },
    });
    expect(get(s, 'pomodoro').focusOverrideMs).toBeNull();
  });

  it('updating targetCycles alone preserves focusOverrideMs', () => {
    let s = reducer(makeDefaults(), { type: 'pomodoro/setTime', ms: 30_000 });
    s = reducer(s, {
      type: 'pomodoro/updateSettings',
      settings: { focusMin: 25, pauseMin: 5, targetCycles: 6 },
    });
    expect(get(s, 'pomodoro').focusOverrideMs).toBe(30_000);
  });

  it('setTime during focus writes to focusOverrideMs only', () => {
    const s = reducer(makeDefaults(), { type: 'pomodoro/setTime', ms: 45_000 });
    const p = get(s, 'pomodoro');
    expect(p.focusOverrideMs).toBe(45_000);
    expect(p.pauseOverrideMs).toBeNull();
    expect(p.totalMs).toBe(45_000);
    expect(p.remainingMs).toBe(45_000);
  });

  it('advancePhase from focus uses focusOverrideMs on the next focus', () => {
    // Custom 10s focus → break → next focus should still be 10s, not 25min default.
    let s = reducer(makeDefaults(), { type: 'pomodoro/setTime', ms: 10_000 });
    s = reducer(s, { type: 'pomodoro/advancePhase', now: 0 }); // → pause
    s = reducer(s, { type: 'pomodoro/advancePhase', now: 1 }); // → focus
    const p = get(s, 'pomodoro');
    expect(p.phase).toBe('focus');
    expect(p.totalMs).toBe(10_000);
    expect(p.remainingMs).toBe(10_000);
  });

  it('advancePhase at final cycle stops and resets to focus', () => {
    // Settings: 2 cycles → focus,pause,focus,[pause=done]
    let s = reducer(makeDefaults(), {
      type: 'pomodoro/updateSettings',
      settings: { focusMin: 25, pauseMin: 5, targetCycles: 2 },
    });
    s = reducer(s, { type: 'pomodoro/advancePhase', now: 0 }); // focus → pause, cycle 1
    s = reducer(s, { type: 'pomodoro/advancePhase', now: 1 }); // pause → focus (still cycle 1)
    s = reducer(s, { type: 'pomodoro/advancePhase', now: 2 }); // focus → cycle 2 >= 2, stop
    const p = get(s, 'pomodoro');
    expect(p.phase).toBe('focus');
    expect(p.cycle).toBe(0);
    expect(p.running).toBe(false);
  });

  it('reset preserves overrides and uses them for the restored time', () => {
    let s = reducer(makeDefaults(), { type: 'pomodoro/setTime', ms: 30_000 });
    s = reducer(s, { type: 'pomodoro/reset', now: 0 });
    const p = get(s, 'pomodoro');
    expect(p.focusOverrideMs).toBe(30_000);
    expect(p.pauseOverrideMs).toBeNull();
    expect(p.totalMs).toBe(30_000);
    expect(p.remainingMs).toBe(30_000);
    expect(p.cycle).toBe(0);
    expect(p.phase).toBe('focus');
  });

  it('tick to zero stops the timer but does not auto-advance', () => {
    let s = reducer(makeDefaults(), { type: 'pomodoro/setTime', ms: 500 });
    s = reducer(s, { type: 'pomodoro/setRunning', running: true, now: 0 });
    s = reducer(s, { type: 'pomodoro/tick', delta: 1000, now: 1000 });
    const p = get(s, 'pomodoro');
    expect(p.remainingMs).toBe(0);
    expect(p.running).toBe(false);
    // advancePhase happens in the provider's effect, not in the reducer.
    expect(p.phase).toBe('focus');
  });

  it('advancePhase wrap sets completed=true on the final focus end', () => {
    let s = reducer(makeDefaults(), {
      type: 'pomodoro/updateSettings',
      settings: { focusMin: 1, pauseMin: 1, targetCycles: 2 },
    });
    // Cycle 1: focus → pause
    s = reducer(s, { type: 'pomodoro/advancePhase', now: 0 });
    // Cycle 1: pause → focus (cycle 2's focus session)
    s = reducer(s, { type: 'pomodoro/advancePhase', now: 1 });
    // Cycle 2 focus ends → wrap → completed=true
    s = reducer(s, { type: 'pomodoro/advancePhase', now: 2 });
    const p = get(s, 'pomodoro');
    expect(p.completed).toBe(true);
    expect(p.running).toBe(false);
    expect(p.cycle).toBe(0);
  });

  it('reset clears completed', () => {
    let s = reducer(makeDefaults(), {
      type: 'pomodoro/updateSettings',
      settings: { focusMin: 1, pauseMin: 1, targetCycles: 2 },
    });
    s = reducer(s, { type: 'pomodoro/advancePhase', now: 0 });
    s = reducer(s, { type: 'pomodoro/advancePhase', now: 1 });
    s = reducer(s, { type: 'pomodoro/advancePhase', now: 2 });
    expect(get(s, 'pomodoro').completed).toBe(true);
    s = reducer(s, { type: 'pomodoro/reset', now: 3 });
    expect(get(s, 'pomodoro').completed).toBe(false);
  });

  it('setRunning(true) clears completed', () => {
    let s = reducer(makeDefaults(), {
      type: 'pomodoro/updateSettings',
      settings: { focusMin: 1, pauseMin: 1, targetCycles: 2 },
    });
    s = reducer(s, { type: 'pomodoro/advancePhase', now: 0 });
    s = reducer(s, { type: 'pomodoro/advancePhase', now: 1 });
    s = reducer(s, { type: 'pomodoro/advancePhase', now: 2 });
    expect(get(s, 'pomodoro').completed).toBe(true);
    s = reducer(s, { type: 'pomodoro/setRunning', running: true, now: 3 });
    expect(get(s, 'pomodoro').completed).toBe(false);
  });
});

describe('shared reducer actions', () => {
  it('setColor updates only the targeted timer', () => {
    const s = reducer(makeDefaults(), { type: 'setColor', kind: 'pomodoro', color: '#000' });
    expect(get(s, 'pomodoro').color).toBe('#000');
    expect(get(s, 'countdown').color).toBe('#ef4444');
  });

  it('setPersistent flips the flag on the targeted timer only', () => {
    const s = reducer(makeDefaults(), { type: 'setPersistent', kind: 'stopwatch', persistent: true });
    expect(get(s, 'stopwatch').persistent).toBe(true);
    expect(get(s, 'pomodoro').persistent).toBe(false);
  });

  it('load replaces timers by kind', () => {
    const custom: CountdownTimer = {
      id: 'countdown', kind: 'countdown', color: '#fff', persistent: true,
      totalMs: 1000, remainingMs: 1000, running: false, startedAt: null, zeroedAt: null,
    };
    const s = reducer(makeDefaults(), { type: 'load', timers: [custom] });
    expect(get(s, 'countdown').color).toBe('#fff');
    // Kinds not in the payload keep their defaults.
    expect(get(s, 'stopwatch').color).toBe('#22d3ee');
  });
});

describe('computeFireAt', () => {
  it('returns today at the requested time when in the future', () => {
    // 2026-04-14 10:00:00 local
    const now = new Date(2026, 3, 14, 10, 0, 0).getTime();
    const fire = computeFireAt('15:30', now);
    expect(new Date(fire).getHours()).toBe(15);
    expect(new Date(fire).getMinutes()).toBe(30);
    expect(new Date(fire).getDate()).toBe(14);
  });

  it('returns tomorrow when the requested time is earlier today', () => {
    const now = new Date(2026, 3, 14, 16, 0, 0).getTime();
    const fire = computeFireAt('15:30', now);
    expect(new Date(fire).getDate()).toBe(15);
    expect(new Date(fire).getHours()).toBe(15);
    expect(new Date(fire).getMinutes()).toBe(30);
  });

  it('returns tomorrow when target equals current minute exactly', () => {
    // Edge: same HH:MM as now → "in the past or equal" → tomorrow
    const now = new Date(2026, 3, 14, 15, 30, 30).getTime();
    const fire = computeFireAt('15:30', now);
    expect(new Date(fire).getDate()).toBe(15);
  });

  it('throws on malformed HH:MM string', () => {
    expect(() => computeFireAt('bad', 0)).toThrow();
    expect(() => computeFireAt('1230', 0)).toThrow();
    expect(() => computeFireAt('', 0)).toThrow();
  });

  it('throws on out-of-range hours or minutes', () => {
    expect(() => computeFireAt('25:00', 0)).toThrow();
    expect(() => computeFireAt('12:60', 0)).toThrow();
    expect(() => computeFireAt('-1:00', 0)).toThrow();
  });
});

describe('alarm reducer', () => {
  it('alarm/setTime updates the displayed targetTime only', () => {
    const s = reducer(makeDefaults(), { type: 'alarm/setTime', time: '07:30' });
    const a = get(s, 'alarm');
    expect(a.targetTime).toBe('07:30');
    expect(a.fireAt).toBeNull();
    expect(a.running).toBe(false);
    // lastSetTime is only updated on arm, not on raw edits.
    expect(a.lastSetTime).toBe('12:30');
  });

  it('alarm/arm computes fireAt, sets running, persists lastSetTime', () => {
    const now = new Date(2026, 3, 14, 10, 0, 0).getTime();
    let s = reducer(makeDefaults(), { type: 'alarm/setTime', time: '15:30' });
    s = reducer(s, { type: 'alarm/arm', now });
    const a = get(s, 'alarm');
    expect(a.fireAt).not.toBeNull();
    expect(new Date(a.fireAt!).getHours()).toBe(15);
    expect(a.running).toBe(true);
    expect(a.lastSetTime).toBe('15:30');
  });

  it('alarm/cancel disarms but preserves targetTime and lastSetTime', () => {
    const now = new Date(2026, 3, 14, 10, 0, 0).getTime();
    let s = reducer(makeDefaults(), { type: 'alarm/setTime', time: '15:30' });
    s = reducer(s, { type: 'alarm/arm', now });
    s = reducer(s, { type: 'alarm/cancel' });
    const a = get(s, 'alarm');
    expect(a.fireAt).toBeNull();
    expect(a.running).toBe(false);
    expect(a.ringing).toBe(false);
    expect(a.targetTime).toBe('15:30');
    expect(a.lastSetTime).toBe('15:30');
  });

  it('alarm/tick sets ringing when now >= fireAt', () => {
    const now = new Date(2026, 3, 14, 10, 0, 0).getTime();
    let s = reducer(makeDefaults(), { type: 'alarm/setTime', time: '15:30' });
    s = reducer(s, { type: 'alarm/arm', now });
    // Tick at the exact fire time
    const tickNow = new Date(2026, 3, 14, 15, 30, 0).getTime();
    s = reducer(s, { type: 'alarm/tick', now: tickNow });
    const a = get(s, 'alarm');
    expect(a.ringing).toBe(true);
    expect(a.running).toBe(false);
    expect(a.fireAt).toBeNull();
  });

  it('alarm/tick before fire time is a no-op', () => {
    const now = new Date(2026, 3, 14, 10, 0, 0).getTime();
    let s = reducer(makeDefaults(), { type: 'alarm/setTime', time: '15:30' });
    s = reducer(s, { type: 'alarm/arm', now });
    const tickNow = new Date(2026, 3, 14, 14, 0, 0).getTime();
    s = reducer(s, { type: 'alarm/tick', now: tickNow });
    const a = get(s, 'alarm');
    expect(a.ringing).toBe(false);
    expect(a.running).toBe(true);
  });

  it('alarm/stop clears ringing', () => {
    const now = new Date(2026, 3, 14, 10, 0, 0).getTime();
    let s = reducer(makeDefaults(), { type: 'alarm/setTime', time: '15:30' });
    s = reducer(s, { type: 'alarm/arm', now });
    s = reducer(s, { type: 'alarm/tick', now: new Date(2026, 3, 14, 15, 30, 0).getTime() });
    s = reducer(s, { type: 'alarm/stop' });
    const a = get(s, 'alarm');
    expect(a.ringing).toBe(false);
    expect(a.running).toBe(false);
    expect(a.fireAt).toBeNull();
    // targetTime stays at the last-armed time so re-arming uses it.
    expect(a.targetTime).toBe('15:30');
  });

  it('arming with a past wall-clock time schedules tomorrow', () => {
    const now = new Date(2026, 3, 14, 16, 0, 0).getTime();
    let s = reducer(makeDefaults(), { type: 'alarm/setTime', time: '08:00' });
    s = reducer(s, { type: 'alarm/arm', now });
    const a = get(s, 'alarm');
    expect(new Date(a.fireAt!).getDate()).toBe(15);
    expect(new Date(a.fireAt!).getHours()).toBe(8);
  });
});

// Silence unused-import warnings on types only used for narrowing.
void ({} as PomodoroTimer);
void ({} as StopwatchTimer);
