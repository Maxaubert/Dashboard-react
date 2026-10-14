import { describe, it, expect } from 'vitest';
import { normaliseHome } from './useHome';
import type { HomeEnvelope } from '@/api/types';

describe('normaliseHome — hidden', () => {
  it('defaults hidden to [] when the key is missing', () => {
    const result = normaliseHome({ version: 1, sections: ['todo'] });
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

  it('preserves existing widgets and habit history through layout saves', () => {
    const legacy = { version: 1, sections: ['todo'], hidden: [], widgets: [{ id: 'w1', type: 'habit', refId: 'h1' }], habits: [{ id: 'h1', name: 'Les', color: '#9fd07a', completedDays: ['2026-09-27'], createdAt: '2026-09-01' }] };
    const result = normaliseHome(legacy as unknown as Partial<HomeEnvelope>);
    expect(result).toEqual(legacy);
    expect(normaliseHome({ ...result, hidden: ['widgets'] }).habits).toEqual(legacy.habits);
  });

  it('defaults missing widget arrays without losing section preferences', () => {
    expect(normaliseHome({ sections: ['todo'], hidden: ['vaer'] })).toEqual({
      version: 1, sections: ['todo'], hidden: ['vaer'], widgets: [], habits: [],
    });
  });
});
