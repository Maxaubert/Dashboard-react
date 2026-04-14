import { useEffect, useRef } from 'react';
import { useHome, useSaveHome } from './useHome';
import { readLocalStorageHome, decideMigration, clearLocalStorageHome } from '@/lib/homeMigration';

const MIGRATED_FLAG_KEY = 'home-migrated-to-backend-v1';

/**
 * One-shot migration: on first successful home load, if the backend is empty
 * and localStorage still has the legacy keys, push the local data up and
 * clear the keys. Idempotent — guarded by a localStorage flag AND an
 * in-component ref against StrictMode double-invocation.
 */
export function useHomeMigration() {
  const home = useHome();
  const save = useSaveHome();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    if (!home.data) return;
    if (localStorage.getItem(MIGRATED_FLAG_KEY) === 'true') {
      ranRef.current = true;
      return;
    }

    const local = readLocalStorageHome();
    const decision = decideMigration(home.data, local);

    ranRef.current = true;

    if (!decision.shouldMigrate) {
      localStorage.setItem(MIGRATED_FLAG_KEY, 'true');
      return;
    }

    save.mutate(decision.next, {
      onSuccess: () => {
        clearLocalStorageHome();
        localStorage.setItem(MIGRATED_FLAG_KEY, 'true');
      },
    });
  }, [home.data, save]);
}
