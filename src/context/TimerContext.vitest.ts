import { describe, it, expect } from 'vitest';
import {
  reducer,
  makeDefaults,
  clamp,
  POMODORO_MINUTE_MS,
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

  it('reset clears overrides and restores settings-derived time', () => {
    let s = reducer(makeDefaults(), { type: 'pomodoro/setTime', ms: 30_000 });
    s = reducer(s, { type: 'pomodoro/reset', now: 0 });
    const p = get(s, 'pomodoro');
    expect(p.focusOverrideMs).toBeNull();
    expect(p.pauseOverrideMs).toBeNull();
    expect(p.totalMs).toBe(25 * POMODORO_MINUTE_MS);
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

// Silence unused-import warnings on types only used for narrowing.
void ({} as PomodoroTimer);
void ({} as StopwatchTimer);
