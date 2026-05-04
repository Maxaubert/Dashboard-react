import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ReportModal } from './ReportModal';

interface ReportContextValue {
  /** Open the global report modal. */
  openReport: () => void;
}

const ReportContext = createContext<ReportContextValue | null>(null);

/**
 * Mounts the report modal once at the app root and exposes an
 * `openReport()` trigger via context. This keeps the modal alive
 * independently of which UI surface invoked it (sidebar button,
 * mobile drawer, command palette, …) — important because the mobile
 * drawer auto-closes on item activation, and an inline modal would
 * unmount with it.
 */
export function ReportProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openReport = useCallback(() => setOpen(true), []);

  const value = useMemo(() => ({ openReport }), [openReport]);

  return (
    <ReportContext.Provider value={value}>
      {children}
      <ReportModal open={open} onOpenChange={setOpen} />
    </ReportContext.Provider>
  );
}

export function useReport(): ReportContextValue {
  const ctx = useContext(ReportContext);
  if (!ctx) throw new Error('useReport must be used inside <ReportProvider>');
  return ctx;
}
