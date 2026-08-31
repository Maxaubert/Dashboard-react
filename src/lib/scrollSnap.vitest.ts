import { describe, it, expect, vi, type Mock } from 'vitest';
import { suspendScrollSnap, type SnapScroller } from './scrollSnap';

type ScrollTo = NonNullable<SnapScroller['scrollTo']>;

function scroller(inlineSnap = ''): SnapScroller & { scrollTo: Mock<ScrollTo> } {
  return { scrollLeft: 120, style: { scrollSnapType: inlineSnap }, scrollTo: vi.fn<ScrollTo>() };
}

describe('suspendScrollSnap', () => {
  it('sets the inline scroll-snap-type to none while suspended', () => {
    const el = scroller();
    suspendScrollSnap(el);
    expect(el.style.scrollSnapType).toBe('none');
    expect(el.scrollTo).not.toHaveBeenCalled();
  });

  it('restores the previous inline value, including an empty one', () => {
    const el = scroller();
    suspendScrollSnap(el)();
    expect(el.style.scrollSnapType).toBe('');

    const custom = scroller('x mandatory');
    suspendScrollSnap(custom)();
    expect(custom.style.scrollSnapType).toBe('x mandatory');
  });

  it('asks for a smooth scroll to the current offset on restore so the engine re-snaps', () => {
    const el = scroller();
    const restore = suspendScrollSnap(el);
    el.scrollLeft = 225;
    restore();
    expect(el.scrollTo).toHaveBeenCalledWith({ left: 225, behavior: 'smooth' });
  });

  it('tolerates a scroller without scrollTo', () => {
    const el: SnapScroller = { scrollLeft: 0, style: { scrollSnapType: '' } };
    expect(() => suspendScrollSnap(el)()).not.toThrow();
    expect(el.style.scrollSnapType).toBe('');
  });
});
