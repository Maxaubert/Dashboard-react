import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import {
  GLASS_MODE_KEY,
  GLASS_MODE_DEFAULT,
  applyGlassModeClass,
} from '@/lib/glassMode';

type GlassModeValue = {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
};

const GlassModeContext = createContext<GlassModeValue | null>(null);

/**
 * Owns the single source of truth for transparent mode: one localStorage-backed
 * boolean, applied to <body> as the `glass-mode` class for its lifetime. Wrap
 * the authed app so the class is applied on every route.
 */
export function GlassModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useLocalStorage<boolean>(
    GLASS_MODE_KEY,
    GLASS_MODE_DEFAULT,
  );

  useEffect(() => {
    applyGlassModeClass(enabled);
    return () => applyGlassModeClass(false);
  }, [enabled]);

  return (
    <GlassModeContext.Provider value={{ enabled, setEnabled: (on) => setEnabled(on) }}>
      {children}
    </GlassModeContext.Provider>
  );
}

export function useGlassMode(): GlassModeValue {
  const ctx = useContext(GlassModeContext);
  if (!ctx) throw new Error('useGlassMode must be used within GlassModeProvider');
  return ctx;
}
