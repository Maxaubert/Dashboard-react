import { type ReactNode } from 'react';

/** Top-level layout: just centers the page content. The dashboard is a
 *  single page now; per-area pages render inside the PageOverlay. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <div className="main-content">{children}</div>
    </div>
  );
}
