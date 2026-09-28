import { useCallback } from 'react';
import { randomId } from '@/lib/randomId';
import { useHome, useMutateHome } from './useHome';
import type { HomeHabit } from '@/api/types';

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

/** Returns `iso` shifted by `days` (can be negative), as "YYYY-MM-DD". */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Calculate the current streak from a completedDays list (sorted or not).
 * Counts consecutive days ending at today OR yesterday (1-day grace period).
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
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useHabits() {
  const { data } = useHome();
  const mutate = useMutateHome();

  const habits: Habit[] = data?.habits ?? [];

  const addHabit = useCallback(
    (name: string, color: string): Habit => {
      const habit: Habit = {
        id: randomId(),
        name,
        color,
        completedDays: [],
        createdAt: new Date().toISOString(),
      };
      mutate((prev) => ({ ...prev, habits: [...prev.habits, habit] }));
      return habit;
    },
    [mutate],
  );

  const updateHabit = useCallback(
    (id: string, patch: Partial<Pick<Habit, 'name' | 'color'>>) => {
      mutate((prev) => ({
        ...prev,
        habits: prev.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)),
      }));
    },
    [mutate],
  );

  const removeHabit = useCallback(
    (id: string) => {
      mutate((prev) => ({
        ...prev,
        habits: prev.habits.filter((h) => h.id !== id),
      }));
    },
    [mutate],
  );

  const toggleDay = useCallback(
    (id: string, date: string) => {
      mutate((prev) => ({
        ...prev,
        habits: prev.habits.map((h) => {
          if (h.id !== id) return h;
          const has = h.completedDays.includes(date);
          return {
            ...h,
            completedDays: has
              ? h.completedDays.filter((d) => d !== date)
              : [...h.completedDays, date],
          };
        }),
      }));
    },
    [mutate],
  );

  return { habits, addHabit, updateHabit, removeHabit, toggleDay };
}
