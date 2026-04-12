import { useCallback, useEffect, useState } from 'react';

/**
 * useState backed by localStorage. Used for view preferences (todo split
 * view, etc.) — not for source-of-truth data, which lives on the server.
 *
 * Reads lazily on first render and writes whenever the value changes.
 * Safe against parse errors and browser environments without storage.
 */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota exceeded or unavailable — fail silently, source of truth is server */
    }
  }, [key, value]);

  const reset = useCallback(() => setValue(initial), [initial]);

  return [value, setValue, reset] as const;
}
