/**
 * Temporarily switch CSS scroll snapping off on a scroller while script
 * drives its position.
 *
 * Chromium applies `scroll-snap-type` to every programmatic `scrollLeft`
 * write, so a drag-to-scroll gesture on a snapping container jumps between
 * snap points instead of tracking the pointer, and a per-frame inertia loop
 * never moves it at all. The helper takes a structural type so it can be
 * unit tested with a plain object.
 */
export interface SnapScroller {
  scrollLeft: number;
  style: { scrollSnapType: string };
  scrollTo?: (options: { left: number; behavior: 'smooth' | 'auto' | 'instant' }) => void;
}

/**
 * Disable snapping on `el` and return a function that restores it.
 *
 * Restoring the property alone does not make Chromium re-snap, so the
 * restore function also requests a smooth scroll to the current offset:
 * with snapping live again the engine resolves that to the nearest snap
 * position. Non-snapping scrollers see a no-op scroll to where they are.
 */
export function suspendScrollSnap(el: SnapScroller): () => void {
  const previous = el.style.scrollSnapType;
  el.style.scrollSnapType = 'none';
  return () => {
    el.style.scrollSnapType = previous;
    el.scrollTo?.({ left: el.scrollLeft, behavior: 'smooth' });
  };
}
