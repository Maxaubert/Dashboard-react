import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Habit {
  id: string;
  name: string;
  color: string;
  completedDays: string[]; // ISO "YYYY-MM-DD"
  createdAt: string;
}

// ── Pure utilities ────────────────────────────────────────────────────────────

/** Returns today's date as "YYYY-MM-DD" in local time. */
export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Add (or subtract) `delta` days to an ISO date string.
 * Uses Date.UTC so DST transitions don't shift the result.
 */
export function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const ms = Date.UTC(y, m - 1, d + delta);
  const result = new Date(ms);
  const ry = result.getUTCFullYear();
  const rm = String(result.getUTCMonth() + 1).padStart(2, '0');
  const rd = String(result.getUTCDate()).padStart(2, '0');
  return `${ry}-${rm}-${rd}`;
}

/**
 * Count the current streak of consecutive completed days.
 * Supports a grace period: streak may start from yesterday if today is not completed.
 */
export function calcStreak(completedDays: string[]): number {
  if (completedDays.length === 0) return 0;

  const set = new Set(completedDays);
  const today = todayISO();
  const yesterday = addDays(today, -1);

  let cursor: string;
  if (set.has(today)) {
    cursor = today;
  } else if (set.has(yesterday)) {
    cursor = yesterday;
  } else {
    return 0;
  }

  let streak = 0;
  while (set.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useHabits() {
  const [habits, setHabits] = useLocalStorage<Habit[]>('home-habits-v1', []);

  const addHabit = useCallback(
    (name: string, color: string): Habit => {
      const habit: Habit = {
        id: crypto.randomUUID(),
        name,
        color,
        completedDays: [],
        createdAt: new Date().toISOString(),
      };
      setHabits((prev) => [...prev, habit]);
      return habit;
    },
    [setHabits],
  );

  const updateHabit = useCallback(
    (id: string, patch: Partial<Pick<Habit, 'name' | 'color'>>) => {
      setHabits((prev) =>
        prev.map((h) => (h.id === id ? { ...h, ...patch } : h)),
      );
    },
    [setHabits],
  );

  const removeHabit = useCallback(
    (id: string) => {
      setHabits((prev) => prev.filter((h) => h.id !== id));
    },
    [setHabits],
  );

  const toggleDay = useCallback(
    (id: string, date: string) => {
      setHabits((prev) =>
        prev.map((h) => {
          if (h.id !== id) return h;
          const has = h.completedDays.includes(date);
          return {
            ...h,
            completedDays: has
              ? h.completedDays.filter((d) => d !== date)
              : [...h.completedDays, date],
          };
        }),
      );
    },
    [setHabits],
  );

  return { habits, addHabit, updateHabit, removeHabit, toggleDay };
}
