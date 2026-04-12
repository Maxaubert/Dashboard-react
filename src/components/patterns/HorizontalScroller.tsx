import {
  useEffect,
  useRef,
  type HTMLAttributes,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { cn } from '@/lib/cn';

interface HorizontalScrollerProps extends HTMLAttributes<HTMLDivElement> {
  /** Apply edge fade masks. */
  fade?: boolean;
  /** Enable click-and-drag-to-scroll (great on desktop). Touch already inertial. */
  draggable?: boolean;
  children: ReactNode;
}

/**
 * Horizontal scrolling container with edge fade masks and optional
 * mouse-drag-to-scroll. Used by the index page for the favourites and
 * news carousels.
 *
 * The actual children are rendered as flex children — callers control
 * spacing via the `gap-*` utility on the wrapper.
 */
export function HorizontalScroller({
  fade = true,
  draggable = true,
  className,
  children,
  ...rest
}: HorizontalScrollerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const dragState = useRef({ down: false, startX: 0, startLeft: 0, moved: false });

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!draggable) return;
    if (e.pointerType !== 'mouse') return; // touch is already inertial
    const el = ref.current;
    if (!el) return;
    dragState.current = {
      down: true,
      startX: e.clientX,
      startLeft: el.scrollLeft,
      moved: false,
    };
    el.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragState.current.down) return;
    const el = ref.current;
    if (!el) return;
    const dx = e.clientX - dragState.current.startX;
    if (Math.abs(dx) > 4) dragState.current.moved = true;
    el.scrollLeft = dragState.current.startLeft - dx;
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (el && el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    dragState.current.down = false;
  }

  // Suppress click events that fire after a drag (so users don't accidentally
  // click items they were trying to scroll past).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      if (dragState.current.moved) {
        e.preventDefault();
        e.stopPropagation();
        dragState.current.moved = false;
      }
    };
    el.addEventListener('click', handler, true);
    return () => el.removeEventListener('click', handler, true);
  }, []);

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={cn(
        'flex flex-row overflow-x-auto no-scrollbar select-none',
        fade && 'mask-fade-x',
        draggable && 'cursor-grab active:cursor-grabbing',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
