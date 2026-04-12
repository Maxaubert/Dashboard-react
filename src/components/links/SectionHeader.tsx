import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type MouseEvent,
} from 'react';
import { cn } from '@/lib/cn';

interface SectionHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onRename'> {
  title: string;
  count: number;
  readonly?: boolean;
  gripRef?: (node: HTMLElement | null) => void;
  gripListeners?: HTMLAttributes<HTMLElement>;
  dragging?: boolean;
  onRename?: (next: string) => void;
  onDelete?: () => void;
}

export const SectionHeader = forwardRef<HTMLDivElement, SectionHeaderProps>(
  function SectionHeader(
    { title, count, readonly, gripRef, gripListeners, dragging, className, onRename, onDelete, ...rest },
    ref,
  ) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuX, setMenuX] = useState(0);
    const [menuY, setMenuY] = useState(0);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(title);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!menuOpen) return;
      const close = () => setMenuOpen(false);
      window.addEventListener('click', close);
      window.addEventListener('scroll', close, true);
      return () => {
        window.removeEventListener('click', close);
        window.removeEventListener('scroll', close, true);
      };
    }, [menuOpen]);

    const onContextMenu = useCallback(
      (e: MouseEvent<HTMLDivElement>) => {
        if (readonly) return;
        e.preventDefault();
        setMenuX(e.clientX);
        setMenuY(e.clientY);
        setMenuOpen(true);
      },
      [readonly],
    );

    function commitRename() {
      const trimmed = draft.trim();
      if (trimmed && trimmed !== title) onRename?.(trimmed);
      setEditing(false);
    }

    return (
      <div
        ref={ref}
        className={cn('links-section-header', dragging && 'dragging', className)}
        onContextMenu={onContextMenu}
        {...rest}
      >
        <span
          ref={gripRef}
          className="links-section-grip"
          {...(gripListeners as React.HTMLAttributes<HTMLElement>)}
          aria-label="Dra for å flytte seksjon"
        >
          ⋮⋮
        </span>

        {editing ? (
          <input
            className="links-section-rename-input"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') {
                setEditing(false);
                setDraft(title);
              }
            }}
          />
        ) : (
          <span className="links-section-title">{title}</span>
        )}
        <span className="links-section-count">{count}</span>

        {menuOpen && !readonly && (
          <div
            ref={menuRef}
            className="section-context-menu"
            style={{ top: menuY, left: menuX }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              onClick={() => {
                setDraft(title);
                setEditing(true);
                setMenuOpen(false);
              }}
            >
              Rename…
            </div>
            <div
              className="del"
              onClick={() => {
                onDelete?.();
                setMenuOpen(false);
              }}
            >
              Delete
            </div>
          </div>
        )}
      </div>
    );
  },
);
