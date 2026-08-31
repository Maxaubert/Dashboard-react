import { useEffect, useState, type MouseEvent } from 'react';
import { cn } from '@/lib/cn';

export interface InlineMenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

interface MenuState {
  x: number;
  y: number;
  items: InlineMenuItem[];
}

/**
 * State-driven right-click menu, used instead of Radix `ContextMenu` inside the
 * Lenker popup. Radix's ContextMenu does not open reliably inside the modal
 * Radix `Dialog` that hosts the popup, whereas a plain state + `position: fixed`
 * menu does — it's the same pattern `SectionHeader` already uses successfully.
 *
 * The rendered menu (see `InlineContextMenuList`) must live under a node with no
 * transformed ancestor, otherwise its fixed coordinates are measured from that
 * ancestor's corner. Render it at the library root, never inside `.ext-link`
 * (which gets a `transform` on hover).
 */
export function useInlineContextMenu() {
  const [menu, setMenu] = useState<MenuState | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    // Escape closes only this menu. Capture on window runs before Radix's
    // document-level escape listener, so stopping propagation here keeps
    // the whole page overlay from closing too.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close();
    };
    window.addEventListener('click', close);
    // A right-click is not a click; openers stopPropagation on the React
    // event, so a capture-phase listener is the only one that sees it.
    window.addEventListener('contextmenu', close, true);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close, true);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [menu]);

  function openMenu(e: MouseEvent, items: InlineMenuItem[]) {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, items });
  }

  return { menu, openMenu, close: () => setMenu(null) };
}

export function InlineContextMenuList({
  menu,
  onClose,
}: {
  menu: MenuState | null;
  onClose: () => void;
}) {
  if (!menu) return null;
  return (
    <div
      className="section-context-menu"
      style={{ top: menu.y, left: menu.x }}
      onClick={(e) => e.stopPropagation()}
    >
      {menu.items.map((item) => (
        <div
          key={item.label}
          className={cn(item.danger && 'del')}
          onClick={() => {
            item.onSelect();
            onClose();
          }}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}
