import {
  closestCorners,
  pointerWithin,
  type CollisionDetection,
} from '@dnd-kit/core';

/** Combined collision detector: prefer the droppable directly under the
 *  pointer (best for empty drop zones), fall back to closest-corners
 *  (best for inserting between sibling cards). */
export const pointerOrCorners: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  return pointer.length > 0 ? pointer : closestCorners(args);
};

/**
 * Install a one-shot `click` listener on document in capture phase that
 * swallows the next click event and auto-unregisters. A safety timeout
 * removes it after 120ms in case no click comes (e.g. drop missed any
 * droppable), so later clicks aren't affected.
 */
export function installOneShotClickSuppress() {
  let done = false;
  function onClick(e: Event) {
    if (done) return;
    done = true;
    e.preventDefault();
    e.stopImmediatePropagation();
    document.removeEventListener('click', onClick, true);
  }
  document.addEventListener('click', onClick, true);
  window.setTimeout(() => {
    if (done) return;
    done = true;
    document.removeEventListener('click', onClick, true);
  }, 120);
}

export function getDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
