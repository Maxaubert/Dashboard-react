import { useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Link2, LogOut, MessageSquarePlus } from 'lucide-react';
import { NAV_ITEMS } from './navConfig';
import { LinksLibraryPopup } from './LinksLibraryPopup';
import { useReport } from '@/components/report/ReportProvider';
import { useCurrentUser, useLogout } from '@/hooks/useCurrentUser';
import { cn } from '@/lib/cn';

interface SidebarProps {
  collapsed: boolean;
  width: number;
  onResize: (newWidth: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

/**
 * Desktop sidebar — uses the legacy `.sidebar` / `.sidebar-link` classes
 * (defined in globals.css) so it matches the original pixel-for-pixel.
 *
 * The sidebar is **resizable**: a thin handle on the right edge accepts
 * pointer drags and reports new widths back to AppShell. AppShell flips
 * to collapsed (icons-only) view automatically when the width drops
 * below its threshold.
 *
 * Active link state is a WHITE 3px inset bar — NOT page-accent colored.
 * That's how nav.js worked, so we match it.
 */
export function Sidebar({
  collapsed,
  width,
  onResize,
  onDragStart,
  onDragEnd,
}: SidebarProps) {
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(0);
  const [linksOpen, setLinksOpen] = useState(false);
  const { openReport } = useReport();
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();

  function handleResizeStart(e: React.PointerEvent) {
    e.preventDefault();
    dragStartXRef.current = e.clientX;
    dragStartWidthRef.current = width;
    onDragStart();

    // Lock the cursor + prevent text selection while dragging.
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - dragStartXRef.current;
      onResize(dragStartWidthRef.current + dx);
    }
    function onUp() {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      onDragEnd();
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  return (
    <nav
      className={cn('sidebar hidden md:flex', collapsed && 'collapsed')}
      aria-label="Hovednavigasjon"
    >
      <Link
        to="/"
        className="sidebar-logo"
        title={collapsed ? 'Dashboard' : undefined}
      >
        <div className="sidebar-logo-mark">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 3h7v7H3V3m0 11h7v7H3v-7m11-11h7v7h-7V3m0 11h7v7h-7v-7" />
          </svg>
        </div>
        <span className="sidebar-logo-text">Dashboard</span>
      </Link>
      <span className="sidebar-section-label">Kategorier</span>
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            isActive ? 'sidebar-link active' : 'sidebar-link'
          }
          title={collapsed ? item.label : undefined}
        >
          {item.icon}
          <span>{item.label}</span>
        </NavLink>
      ))}

      {/* Spacer pushes the bottom-row quick-access icons down. */}
      <div className="sidebar-spacer" aria-hidden="true" />

      <button
        type="button"
        className="sidebar-links-icon"
        onClick={openReport}
        title="Report a bug or idea"
        aria-label="Report a bug or idea"
      >
        <MessageSquarePlus size={18} strokeWidth={1.75} />
      </button>

      <button
        type="button"
        className="sidebar-links-icon"
        onClick={() => setLinksOpen((o) => !o)}
        title="Lenkebibliotek"
        aria-label={linksOpen ? 'Lukk lenkebibliotek' : 'Åpne lenkebibliotek'}
        aria-pressed={linksOpen}
      >
        <Link2 size={18} strokeWidth={1.75} />
      </button>

      <LinksLibraryPopup open={linksOpen} onOpenChange={setLinksOpen} />

      {/* Account row: display name + logout. Plain styling for the MVP. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: 8,
          padding: collapsed ? '8px 0' : '8px 4px',
        }}
      >
        {!collapsed && user && (
          <span
            title={user.email}
            style={{
              fontSize: '0.78rem',
              color: '#a1a1aa',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {user.display_name}
          </span>
        )}
        <button
          type="button"
          className="sidebar-links-icon"
          onClick={() =>
            logout.mutate(undefined, {
              onSuccess: () => navigate('/login', { replace: true }),
            })
          }
          disabled={logout.isPending}
          title="Logg ut"
          aria-label="Logg ut"
        >
          <LogOut size={18} strokeWidth={1.75} />
        </button>
      </div>

      {/* Drag handle on the right edge — invisible by default, fades
       *  in on hover so it doesn't add visual noise. */}
      <div
        className="sidebar-resize-handle"
        onPointerDown={handleResizeStart}
        role="separator"
        aria-orientation="vertical"
        aria-label="Endre størrelse på sidebar"
      />
    </nav>
  );
}
