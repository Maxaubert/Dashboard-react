import { describe, it, expect } from 'vitest';
import { normaliseHome } from './useHome';

describe('normaliseHome — hidden', () => {
  it('defaults hidden to [] when the key is missing', () => {
    const result = normaliseHome({ version: 1, sections: ['todo'], widgets: [], habits: [] });
    expect(result.hidden).toEqual([]);
  });

  it('defaults hidden to [] for null and undefined payloads', () => {
    expect(normaliseHome(null).hidden).toEqual([]);
    expect(normaliseHome(undefined).hidden).toEqual([]);
  });

  it('preserves a provided hidden array', () => {
    const result = normaliseHome({ hidden: ['wishlist', 'vaer'] });
    expect(result.hidden).toEqual(['wishlist', 'vaer']);
  });

  it('ignores a non-array hidden value', () => {
    const result = normaliseHome({ hidden: 'nope' as unknown as string[] });
    expect(result.hidden).toEqual([]);
  });
});
