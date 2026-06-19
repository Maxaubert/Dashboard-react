import { describe, it, expect } from 'vitest';
import { normaliseEnvelope } from './links';
import { FAVORITES_CATEGORY_ID, OTHER_CATEGORY_ID } from './types';

describe('normaliseEnvelope', () => {
  it('wraps a legacy bare array and adds pseudo-categories', () => {
    const env = normaliseEnvelope([{ id: 'a', url: 'x', name: 'n' }] as never);
    expect(env.version).toBe(2);
    expect(env.links).toHaveLength(1);
    const ids = env.categories.map((c) => c.id);
    expect(ids).toContain(FAVORITES_CATEGORY_ID);
    expect(ids).toContain(OTHER_CATEGORY_ID);
  });
  it('returns defaults for null', () => {
    expect(normaliseEnvelope(null).links).toEqual([]);
  });
});
