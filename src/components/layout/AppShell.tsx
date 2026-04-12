import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileDrawer } from './MobileDrawer';
import { cn } from '@/lib/cn';

interface AppShellProps {
  children: ReactNode;
}

/* ───────────────────────────────────────────────────────────────────────── */
/*  Sidebar resize tunables                                                   */
/* ───────────────────────────────────────────────────────────────────────── */

const SIDEBAR_DEFAULT_WIDTH = 220;
const SIDEBAR_MIN_WIDTH = 56;
// Cap at the default — the sidebar can shrink but not grow beyond
// its original width.
const SIDEBAR_MAX_WIDTH = SIDEBAR_DEFAULT_WIDTH;
/** Below this width, the sidebar drops its text labels and shows
 *  icons only. */
const SIDEBAR_COLLAPSE_THRESHOLD = 140;
const PAGE_BASE_MAX_WIDTH = 1240;

function readSavedWidth(): number {
  try {
    const raw = localStorage.getItem('sidebar-width');
    if (!raw) return SIDEBAR_DEFAULT_WIDTH;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return SIDEBAR_DEFAULT_WIDTH;
    return Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, n));
  } catch {
    return SIDEBAR_DEFAULT_WIDTH;
  }
}

/**
 * Top-level layout: sidebar + main column with mobile header.
 *
 * Each page is responsible for its own content wrapper. Most pages render
 * their content inside `<div className="page">` (centered, max-width 1240px,
 * scrolls with body). The Plan page is the exception — it needs a fixed
 * viewport so its calendar grid can scroll independently. AppShell detects
 * the /plan route and applies `.app-shell-full` / `.main-content-full`,
 * which set `height: 100vh; overflow: hidden`.
 *
 * The desktop sidebar is **resizable** via a drag handle on its right
 * edge. When dragged below `SIDEBAR_COLLAPSE_THRESHOLD`, the sidebar
 * automatically switches to collapsed (icons-only) mode. The page's
 * --page-max-width grows by however much horizontal space the sidebar
 * gives up, so content automatically expands into the freed area.
 */
export function AppShell({ children }: AppShellProps) {
  const { pathname } = useLocation();
  // Plan and Notes both use a fixed-viewport shell so their inner panes
  // can scroll independently from the page body.
  const fullHeight = pathname === '/plan' || pathname === '/notes';

  const [sidebarWidth, setSidebarWidth] = useState(readSavedWidth);
  const [dragging, setDragging] = useState(false);

  // Persist width whenever it settles (skip writes mid-drag — they'd
  // hammer localStorage at 60+ Hz with no benefit).
  useEffect(() => {
    if (dragging) return;
    try {
      localStorage.setItem('sidebar-width', String(sidebarWidth));
    } catch {
      /* quota / SSR — ignore */
    }
  }, [sidebarWidth, dragging]);

  // Notes uses a solid #050505 background — no dots, no sweep — exactly
  // like the legacy notes.html. Toggle a body class so the global CSS
  // can hide both layers without React re-mounting them.
  useEffect(() => {
    const cls = 'route-no-grid';
    if (pathname === '/notes') document.body.classList.add(cls);
    else document.body.classList.remove(cls);
    return () => document.body.classList.remove(cls);
  }, [pathname]);

  const collapsed = sidebarWidth < SIDEBAR_COLLAPSE_THRESHOLD;
  const pageMaxWidth =
    PAGE_BASE_MAX_WIDTH + Math.max(0, SIDEBAR_DEFAULT_WIDTH - sidebarWidth);

  function clampWidth(w: number) {
    return Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, w));
  }

  function onResize(w: number) {
    setSidebarWidth(clampWidth(w));
  }

  return (
    <div
      className={cn(
        'app-shell',
        fullHeight && 'app-shell-full',
        collapsed && 'app-shell-sidebar-collapsed',
        dragging && 'app-shell-dragging'
      )}
      style={{
        ['--sidebar-width' as string]: `${sidebarWidth}px`,
        ['--page-max-width' as string]: `${pageMaxWidth}px`,
      }}
    >
      <Sidebar
        collapsed={collapsed}
        width={sidebarWidth}
        onResize={onResize}
        onDragStart={() => setDragging(true)}
        onDragEnd={() => setDragging(false)}
      />
      <div className={cn('main-content', fullHeight && 'main-content-full')}>
        <header className="mobile-header md:hidden">
          <Link to="/" className="header-logo">
            <div className="header-logo-mark">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 3h7v7H3V3m0 11h7v7H3v-7m11-11h7v7h-7V3m0 11h7v7h-7v-7" />
              </svg>
            </div>
            <span className="header-title-main">Dashboard</span>
          </Link>
          <MobileDrawer />
        </header>
        {children}
      </div>
    </div>
  );
}
