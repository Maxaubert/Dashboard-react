import { useCallback } from 'react';
import { randomId } from '@/lib/randomId';
import { useHome, useSaveHome } from './useHome';
import type { HomeEnvelope, HomeHabit } from '@/api/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Habit = HomeHabit;

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
  const { data } = useHome();
  const save = useSaveHome();

  const habits: Habit[] = data?.habits ?? [];

  const commit = useCallback(
    (nextHabits: Habit[]) => {
      const base: HomeEnvelope = data ?? { version: 1, sections: [], widgets: [], habits: [] };
      save.mutate({ ...base, habits: nextHabits });
    },
    [data, save],
  );

  const addHabit = useCallback(
    (name: string, color: string): Habit => {
      const habit: Habit = {
        id: randomId(),
        name,
        color,
        completedDays: [],
        createdAt: new Date().toISOString(),
      };
      commit([...habits, habit]);
      return habit;
    },
    [habits, commit],
  );

  const updateHabit = useCallback(
    (id: string, patch: Partial<Pick<Habit, 'name' | 'color'>>) => {
      commit(habits.map((h) => (h.id === id ? { ...h, ...patch } : h)));
    },
    [habits, commit],
  );

  const removeHabit = useCallback(
    (id: string) => {
      commit(habits.filter((h) => h.id !== id));
    },
    [habits, commit],
  );

  const toggleDay = useCallback(
    (id: string, date: string) => {
      commit(
        habits.map((h) => {
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
    [habits, commit],
  );

  return { habits, addHabit, updateHabit, removeHabit, toggleDay };
}
