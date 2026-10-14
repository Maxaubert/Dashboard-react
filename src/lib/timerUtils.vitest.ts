// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatHMS, formatStopwatch, parseTimeString, playFocusEndAlarm, startLoopingAlarm, stopLoopingAlarm } from './timerUtils';

const contexts: FakeAudioContext[] = [];
class FakeAudioContext {
  currentTime = 0;
  state = 'running';
  destination = {};
  close = vi.fn(async () => { this.state = 'closed'; });
  resume = vi.fn(async () => {});
  createOscillator = () => ({
    connect: vi.fn(), frequency: { value: 0 }, type: 'sine', start: vi.fn(), stop: vi.fn(),
  });
  createGain = () => ({
    connect: vi.fn(), gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
  });
  constructor() { contexts.push(this); }
}

beforeEach(() => {
  vi.useFakeTimers();
  contexts.length = 0;
  vi.stubGlobal('AudioContext', FakeAudioContext);
});
afterEach(() => {
  stopLoopingAlarm();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('timer formatting', () => {
  it('formats countdown and lap times', () => {
    expect(formatHMS(3661)).toBe('1:01:01');
    expect(formatHMS(60)).toBe('01:00');
    expect(formatStopwatch(61_230)).toBe('01:01.23');
  });
  it('parses minutes and clock notation within a day', () => {
    expect(parseTimeString('5')).toBe(300_000);
    expect(parseTimeString('1:30')).toBe(90_000);
    expect(parseTimeString('1:30:00')).toBe(5_400_000);
    expect(parseTimeString('bad')).toBeNull();
    expect(parseTimeString('25:00:00')).toBeNull();
  });
});

describe('timer audio lifecycle', () => {
  it('closes one-shot audio contexts after the beep sequence finishes', () => {
    playFocusEndAlarm();
    expect(contexts).toHaveLength(1);
    expect(contexts[0].close).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    expect(contexts[0].close).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('starts only one alarm loop and stops audio already playing', () => {
    startLoopingAlarm();
    startLoopingAlarm();
    expect(contexts).toHaveLength(1);
    vi.advanceTimersByTime(900);
    expect(contexts).toHaveLength(2);
    stopLoopingAlarm();
    expect(contexts.every((context) => context.close.mock.calls.length === 1)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(contexts).toHaveLength(2);
  });
});
