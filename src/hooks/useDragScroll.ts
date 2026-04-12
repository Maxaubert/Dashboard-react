import { useCallback, useEffect, useRef } from 'react';

interface UseDragScrollOptions {
  /**
   * Treat the scroller as infinite. Caller must render the items N× in a
   * row (see `copies`); the hook positions the user in the middle copy
   * and snaps them by one copy when they drift toward either edge. The
   * snap is invisible because all copies are identical.
   */
  infinite?: boolean;
  /**
   * Number of identical copies the caller has rendered. Default 3. Use
   * more copies when the items don't fill the viewport — the safe wrap
   * zone is `[copyWidth, scrollWidth - clientWidth - copyWidth]`, which
   * collapses (and disables wrapping) if the rendered content isn't
   * substantially wider than the viewport.
   */
  copies?: number;
  /** Friction applied to velocity each frame during inertia. 0.94 ≈ legacy. */
  friction?: number;
  /** Velocity below this magnitude (px/frame) ends the inertia animation. */
  minVelocity?: number;
}

/**
 * Drag-to-scroll with mouse + inertia, optionally infinite-looping.
 *
 * Returns a ref to attach to a horizontally-scrollable element. The hook
 * captures pointer events, tracks velocity, and applies a momentum decay
 * after release. Touch is left untouched so the native iOS/Android
 * inertia kicks in for those devices.
 *
 * Click suppression: a click that fires immediately after a drag is
 * cancelled so the user doesn't accidentally activate a card they were
 * trying to scroll past.
 */
export function useDragScroll<T extends HTMLElement>(options: UseDragScrollOptions = {}) {
  const { infinite = false, copies = 3, friction = 0.94, minVelocity = 0.3 } = options;
  const ref = useRef<T>(null);

  const state = useRef({
    down: false,
    startX: 0,
    startScroll: 0,
    lastX: 0,
    lastTime: 0,
    velocity: 0,
    moved: false,
  });
  const rafRef = useRef<number | null>(null);

  // Snap the scroll position back into the safe zone when the user
  // drifts toward either edge of the rendered copies. The safe zone is
  // [copyWidth, scrollWidth - clientWidth - copyWidth] — i.e. the user
  // must always have at least one full copy of items both behind them
  // (so they can keep scrolling backward) and ahead-plus-on-screen (so
  // they can keep scrolling forward). If the safe zone is empty (not
  // enough copies rendered to cover the viewport), wrapping is disabled.
  const wrap = useCallback(() => {
    if (!infinite) return;
    const el = ref.current;
    if (!el) return;
    const sw = el.scrollWidth;
    const cw = el.clientWidth;
    if (sw <= cw) return;
    const copyWidth = sw / copies;
    if (copyWidth <= 0) return;
    const safeMin = copyWidth;
    const safeMax = sw - cw - copyWidth;
    if (safeMin >= safeMax) return; // not enough buffer; bail
    if (el.scrollLeft < safeMin) el.scrollLeft += copyWidth;
    else if (el.scrollLeft > safeMax) el.scrollLeft -= copyWidth;
  }, [infinite, copies]);

  const animate = useCallback(() => {
    const el = ref.current;
    if (!el) {
      rafRef.current = null;
      return;
    }
    const s = state.current;
    if (Math.abs(s.velocity) < minVelocity) {
      rafRef.current = null;
      return;
    }
    el.scrollLeft += s.velocity;
    s.velocity *= friction;
    wrap();
    rafRef.current = requestAnimationFrame(animate);
  }, [friction, minVelocity, wrap]);

  // Position the user at the start of the middle copy on mount. Polls
  // for up to ~1s to handle async data loads (links arriving after the
  // first paint) — once data lands, the parent flips `infinite` from
  // false → true which re-runs this effect with the children rendered.
  useEffect(() => {
    if (!infinite) return;
    const el = ref.current;
    if (!el) return;

    let attempts = 0;
    const trySetInitial = () => {
      const sw = el.scrollWidth;
      if (sw > 0) {
        const copyWidth = sw / copies;
        // Start at the beginning of the middle copy (rounding down for
        // even copy counts so we always have ≥ floor(copies/2) copies of
        // headroom both ahead and behind).
        el.scrollLeft = copyWidth * Math.floor(copies / 2);
        return;
      }
      if (attempts++ < 60) {
        requestAnimationFrame(trySetInitial);
      }
    };
    requestAnimationFrame(trySetInitial);
  }, [infinite, copies]);

  // Pointer + click handlers.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function onPointerDown(e: PointerEvent) {
      // Let touch keep its native momentum (-webkit-overflow-scrolling: touch).
      if (e.pointerType === 'touch') return;
      const s = state.current;
      s.down = true;
      s.moved = false;
      s.startX = e.clientX;
      s.startScroll = el!.scrollLeft;
      s.lastX = e.clientX;
      s.lastTime = performance.now();
      s.velocity = 0;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      // Intentionally NOT calling setPointerCapture here — see onPointerMove.
      // Capturing on pointerdown intercepts the pointer for the entire
      // gesture, which prevents the browser from delivering `click` events
      // to inner <a> tags. We only capture once an actual drag begins.
    }

    function onPointerMove(e: PointerEvent) {
      const s = state.current;
      if (!s.down) return;
      const dx = e.clientX - s.startX;

      if (Math.abs(dx) > 4) {
        // First time the user crosses the drag threshold — start the drag.
        // Capture the pointer so we keep receiving move events even if the
        // mouse leaves the scroller, and mark `moved` so the upcoming click
        // event (if any) gets suppressed.
        if (!s.moved) {
          s.moved = true;
          try {
            el!.setPointerCapture(e.pointerId);
          } catch {
            /* ignore — element not focusable */
          }
        }
      }
      // Don't scroll for tiny mouse jitter; only once a drag is in progress.
      if (!s.moved) return;

      el!.scrollLeft = s.startScroll - dx;

      const now = performance.now();
      const dt = now - s.lastTime;
      if (dt > 0) {
        s.velocity = ((s.lastX - e.clientX) / dt) * 16;
      }
      s.lastX = e.clientX;
      s.lastTime = now;
      wrap();
    }

    function onPointerUp(e: PointerEvent) {
      const s = state.current;
      if (!s.down) return;
      s.down = false;
      // Only release if we actually captured (i.e. a drag happened).
      if (s.moved) {
        try {
          el!.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      if (Math.abs(s.velocity) > minVelocity && rafRef.current === null) {
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    function onScroll() {
      wrap();
    }

    // Suppress the click that fires after a drag, so users don't
    // accidentally open the card they were dragging past.
    function onClickCapture(e: MouseEvent) {
      if (state.current.moved) {
        e.preventDefault();
        e.stopPropagation();
        state.current.moved = false;
      }
    }

    // Swallow the browser's native HTML5 drag (the "ghost" preview with
    // the no-drop cursor that fires on <a> and <img> elements). Without
    // this, click-and-hold on a link card starts a native drag instead
    // of our pointer-based scroll.
    function onDragStart(e: DragEvent) {
      e.preventDefault();
    }

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('click', onClickCapture, true);
    el.addEventListener('dragstart', onDragStart);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('click', onClickCapture, true);
      el.removeEventListener('dragstart', onDragStart);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [animate, minVelocity, wrap]);

  return ref;
}
