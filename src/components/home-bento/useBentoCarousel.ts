import { useEffect } from 'react';
import { useDragScroll } from '@/hooks/useDragScroll';

/**
 * Horizontal carousel scroller for the bento rows (links / games / news).
 *
 * Combines the shared `useDragScroll` (pointer drag + inertia + click
 * suppression on anchors) with wheel-to-horizontal mapping. The container
 * uses `overflow: hidden` in bento.css so there's never a native scrollbar;
 * all scrolling is JS-driven. At either end of the row we let the wheel
 * event fall through so the page scrolls normally.
 */
export function useBentoCarousel<T extends HTMLElement>(
  opts: { infinite?: boolean; copies?: number } = {},
) {
  const { infinite = false, copies = 3 } = opts;
  const ref = useDragScroll<T>({ infinite, copies });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      const node = el!;
      if (node.scrollWidth <= node.clientWidth) return;
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      // Infinite rows loop forever, so there is no edge to release at — the
      // wrap logic in useDragScroll keeps the position in the safe zone.
      if (!infinite) {
        const atStart = node.scrollLeft <= 0;
        const atEnd = node.scrollLeft >= node.scrollWidth - node.clientWidth - 1;
        // Let the page scroll vertically when we're already at an edge.
        if ((delta < 0 && atStart) || (delta > 0 && atEnd)) return;
      }
      node.scrollLeft += delta;
      e.preventDefault();
    }

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ref, infinite]);

  return ref;
}
