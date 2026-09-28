import { describe, expect, it } from 'vitest';
import { makeDefaults, reducer, type TimerInstance } from './timerState';
import { advanceTimers, restoreTimers, timerStorageKey } from './timerStorage';

function timer<K extends TimerInstance['kind']>(timers: TimerInstance[], kind: K) {
  return timers.find((item) => item.kind === kind) as Extract<TimerInstance, { kind: K }>;
}

describe('timer persistence', () => {
  it('scopes snapshots by account without reading the old shared key', () => {
    expect(timerStorageKey('user-a')).not.toBe(timerStorageKey('user-b'));
    expect(timerStorageKey('user/a')).toBe('home-timers-v6:user%2Fa');
  });

  it('recovers defaults from malformed or missing snapshots', () => {
    for (const raw of [null, '', '{', 'null', '[]', '{}', '{"timers":null}']) {
      expect(restoreTimers(raw, 100)).toEqual(makeDefaults());
    }
  });

  it('validates fields independently and keeps all four timer kinds', () => {
    const raw = JSON.stringify({ savedAt: 0, timers: [
      { kind: 'countdown', remainingMs: -10, totalMs: 'broken', running: 'yes' },
      { kind: 'pomodoro', settings: { focusMin: 0, pauseMin: 99999, targetCycles: 999999 }, cycle: 999999 },
      { kind: 'stopwatch', elapsedMs: 'bad', laps: ['bad', 10, -1, null] },
      { kind: 'alarm', targetTime: '99:99', running: true, fireAt: 'bad' },
    ] });
    const restored = restoreTimers(raw, 100);
    expect(restored).toHaveLength(4);
    expect(timer(restored, 'countdown').remainingMs).toBe(300_000);
    expect(timer(restored, 'countdown').running).toBe(false);
    expect(timer(restored, 'pomodoro').settings).toEqual({ focusMin: 1, pauseMin: 60, targetCycles: 12 });
    expect(timer(restored, 'pomodoro').cycle).toBe(11);
    expect(timer(restored, 'stopwatch').laps).toEqual([10]);
    expect(timer(restored, 'alarm').running).toBe(false);
  });

  it('accounts for elapsed time while a running countdown and stopwatch were closed', () => {
    let timers = reducer(makeDefaults(), { type: 'countdown/setRunning', running: true, now: 1000 });
    timers = reducer(timers, { type: 'stopwatch/setRunning', running: true, now: 1000 });
    const restored = restoreTimers(JSON.stringify({ savedAt: 1000, timers }), 61_000);
    expect(timer(restored, 'countdown').remainingMs).toBe(240_000);
    expect(timer(restored, 'stopwatch').elapsedMs).toBe(60_000);
  });

  it('keeps paused timers unchanged and does not run backwards after clock correction', () => {
    const timers = makeDefaults();
    expect(restoreTimers(JSON.stringify({ savedAt: 1000, timers }), 61_000)).toEqual(timers);
    const started = reducer(timers, { type: 'stopwatch/setRunning', running: true, now: 1000 });
    expect(timer(restoreTimers(JSON.stringify({ savedAt: 1000, timers: started }), 500), 'stopwatch').elapsedMs).toBe(0);
  });

  it('restores an expired countdown and a due alarm as completed', () => {
    const now = new Date(2026, 8, 28, 10, 0).getTime();
    let timers = reducer(makeDefaults(), { type: 'countdown/setRunning', running: true, now });
    timers = reducer(timers, { type: 'alarm/setTime', time: '10:01' });
    timers = reducer(timers, { type: 'alarm/arm', now });
    const restored = restoreTimers(JSON.stringify({ savedAt: now, timers }), now + 600_000);
    expect(timer(restored, 'countdown')).toMatchObject({ running: false, remainingMs: 0, zeroedAt: now + 300_000 });
    expect(timer(restored, 'alarm')).toMatchObject({ ringing: true, running: false });
  });
});

describe('elapsed Pomodoro phases', () => {
  const started = () => reducer(reducer(makeDefaults(), {
    type: 'pomodoro/updateSettings', settings: { focusMin: 1, pauseMin: 1, targetCycles: 3 },
  }), { type: 'pomodoro/setRunning', running: true, now: 0 });

  it('carries overshoot through breaks and later focus sessions', () => {
    const advanced = timer(advanceTimers(started(), 150_000, 150_000), 'pomodoro');
    expect(advanced).toMatchObject({ phase: 'focus', cycle: 1, remainingMs: 30_000, running: true });
  });

  it('finishes the entire cycle after a long sleep without starting a new cycle', () => {
    const advanced = timer(advanceTimers(started(), 86_400_000, 86_400_000), 'pomodoro');
    expect(advanced).toMatchObject({ completed: true, running: false, phase: 'focus', zeroedAt: 300_000 });
  });

  it('preserves custom focus duration when only the target cycle count changes', () => {
    let timers = reducer(makeDefaults(), { type: 'pomodoro/setTime', ms: 30_000 });
    timers = reducer(timers, { type: 'pomodoro/updateSettings', settings: { focusMin: 25, pauseMin: 5, targetCycles: 2 } });
    expect(timer(timers, 'pomodoro')).toMatchObject({ remainingMs: 30_000, totalMs: 30_000, focusOverrideMs: 30_000 });
  });
});
