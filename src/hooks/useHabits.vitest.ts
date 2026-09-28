import { afterEach, describe, expect, it, vi } from 'vitest';
import { addDays, calcStreak, todayISO } from './useHabits';

afterEach(() => vi.useRealTimers());

describe('habit dates and streaks', () => {
  it('uses local dates and crosses month/year boundaries', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 0, 30));
    expect(todayISO()).toBe('2026-01-01');
    expect(addDays(todayISO(), -1)).toBe('2025-12-31');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });
  it('keeps a streak until today ends and ignores duplicate completions', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 28, 12));
    expect(calcStreak(['2026-09-26', '2026-09-27', '2026-09-27'])).toBe(2);
    expect(calcStreak(['2026-09-26', '2026-09-28'])).toBe(1);
    expect(calcStreak(['2026-09-26'])).toBe(0);
  });
});
