import type { HomeEnvelope, HomeWidget, HomeHabit } from '@/api/types';

export const LOCAL_STORAGE_KEYS = [
  'home-section-order',
  'home-widgets-v1',
  'home-habits-v1',
] as const;

function parse<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Read the three legacy localStorage keys into a HomeEnvelope shape. */
export function readLocalStorageHome(): HomeEnvelope {
  return {
    version: 1,
    sections: parse<string[]>('home-section-order', []),
    widgets: parse<HomeWidget[]>('home-widgets-v1', []),
    habits: parse<HomeHabit[]>('home-habits-v1', []),
  };
}

/** Remove all legacy keys — call after a successful migration POST. */
export function clearLocalStorageHome(): void {
  for (const key of LOCAL_STORAGE_KEYS) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
}

export interface MigrationDecision {
  shouldMigrate: boolean;
  next: HomeEnvelope;
}

/**
 * Given the current backend envelope and the localStorage-extracted envelope,
 * decide whether a one-shot migration is needed.
 *
 * Rules:
 *   - If backend has ANY content (sections | widgets | habits non-empty), no migration.
 *   - If both sides are empty, no migration.
 *   - Otherwise push the local envelope up.
 */
export function decideMigration(
  backend: HomeEnvelope,
  local: HomeEnvelope,
): MigrationDecision {
  const backendEmpty =
    backend.sections.length === 0 &&
    backend.widgets.length === 0 &&
    backend.habits.length === 0;
  const localHasAny =
    local.sections.length > 0 ||
    local.widgets.length > 0 ||
    local.habits.length > 0;

  if (!backendEmpty || !localHasAny) {
    return { shouldMigrate: false, next: backend };
  }
  return { shouldMigrate: true, next: local };
}
