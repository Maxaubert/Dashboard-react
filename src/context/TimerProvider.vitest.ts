// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimerProvider, useTimers, type TimerContextValue } from './TimerContext';
import { timerStorageKey } from '@/lib/timerStorage';
import { startLoopingAlarm, stopLoopingAlarm } from '@/lib/timerUtils';

vi.mock('@/lib/timerUtils', () => ({
  startLoopingAlarm: vi.fn(), stopLoopingAlarm: vi.fn(),
  playFocusEndAlarm: vi.fn(), playBreakEndAlarm: vi.fn(),
}));

let root: Root;
let container: HTMLDivElement;
let value: TimerContextValue;
function Probe() { value = useTimers(); return null; }
function render(userId: string) {
  act(() => root.render(createElement(TimerProvider, { userId, children: createElement(Probe) })));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  vi.clearAllMocks();
  localStorage.clear();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('TimerProvider', () => {
  it('settles sub-tick wall time when pausing and records laps accurately', () => {
    render('first');
    act(() => value.setStopwatchRunning(true));
    act(() => vi.advanceTimersByTime(155));
    act(() => value.addStopwatchLap());
    expect(value.getTimer('stopwatch').laps).toEqual([155]);
    act(() => value.setStopwatchRunning(false));
    act(() => vi.advanceTimersByTime(1000));
    expect(value.getTimer('stopwatch').elapsedMs).toBe(155);
  });

  it('keeps account snapshots isolated when the user changes without an outer remount', () => {
    render('first');
    act(() => value.setCountdownTime(2000));
    act(() => value.setCountdownRunning(true));
    act(() => vi.advanceTimersByTime(250));
    render('second');
    expect(value.getTimer('countdown').remainingMs).toBe(300_000);
    expect(value.getTimer('countdown').running).toBe(false);
    act(() => value.setCountdownTime(9000));
    render('first');
    expect(value.getTimer('countdown').remainingMs).toBe(1750);
    expect(value.getTimer('countdown').running).toBe(true);
    const other = JSON.parse(localStorage.getItem(timerStorageKey('second'))!);
    expect(other.timers.find((timer: { kind: string }) => timer.kind === 'countdown').remainingMs).toBe(9000);
  });

  it('flushes elapsed wall time on pagehide and restores completion with an alarm', () => {
    render('first');
    act(() => value.setCountdownTime(1000));
    act(() => value.setCountdownRunning(true));
    act(() => vi.advanceTimersByTime(155));
    window.dispatchEvent(new Event('pagehide'));
    const saved = JSON.parse(localStorage.getItem(timerStorageKey('first'))!);
    expect(saved.timers.find((timer: { kind: string }) => timer.kind === 'countdown').remainingMs).toBe(845);
    render('second');
    act(() => vi.advanceTimersByTime(2000));
    render('first');
    expect(value.getTimer('countdown').remainingMs).toBe(0);
    expect(startLoopingAlarm).toHaveBeenCalled();
    act(() => value.resetCountdown());
    expect(value.getTimer('countdown').running).toBe(false);
    expect(stopLoopingAlarm).toHaveBeenCalled();
  });

  it('keeps one completed timer audible when another is dismissed and stops on unmount', () => {
    render('first');
    act(() => {
      value.setCountdownTime(1000);
      value.setCountdownRunning(true);
      value.updatePomodoroSettings({ focusMin: 1, pauseMin: 1, targetCycles: 1 });
      value.setPomodoroTime(1000);
      value.setPomodoroRunning(true);
    });
    act(() => vi.advanceTimersByTime(1000));
    expect(startLoopingAlarm).toHaveBeenCalledTimes(1);
    vi.mocked(stopLoopingAlarm).mockClear();
    act(() => value.resetCountdown());
    expect(value.getTimer('pomodoro').completed).toBe(true);
    expect(stopLoopingAlarm).not.toHaveBeenCalled();
    render('second');
    expect(stopLoopingAlarm).toHaveBeenCalledTimes(1);
  });
});
