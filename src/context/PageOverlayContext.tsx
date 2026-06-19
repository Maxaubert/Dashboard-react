import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type OverlayKey = 'plan' | 'todo' | 'gaming' | 'links';

interface PageOverlayValue {
  key: OverlayKey | null;
  openOverlay: (key: OverlayKey) => void;
  closeOverlay: () => void;
}

const PageOverlayContext = createContext<PageOverlayValue | null>(null);

export function PageOverlayProvider({ children }: { children: ReactNode }) {
  const [key, setKey] = useState<OverlayKey | null>(null);
  const value = useMemo<PageOverlayValue>(
    () => ({ key, openOverlay: setKey, closeOverlay: () => setKey(null) }),
    [key],
  );
  return <PageOverlayContext.Provider value={value}>{children}</PageOverlayContext.Provider>;
}

export function usePageOverlay(): PageOverlayValue {
  const ctx = useContext(PageOverlayContext);
  if (!ctx) throw new Error('usePageOverlay must be used within PageOverlayProvider');
  return ctx;
}
