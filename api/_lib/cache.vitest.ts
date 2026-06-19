import { describe, it, expect, vi, beforeEach } from 'vitest';

const store: Record<string, { data: unknown; fetched_at: string }> = {};
vi.mock('./supabaseAdmin', () => ({
  admin: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: store['k'] ?? null, error: null }) }) }),
      upsert: async (row: { key: string; data: unknown; fetched_at: string }) => {
        store[row.key] = { data: row.data, fetched_at: row.fetched_at };
        return { error: null };
      },
    }),
  },
}));

import { getCached } from './cache';

beforeEach(() => { for (const k of Object.keys(store)) delete store[k]; });

describe('getCached', () => {
  it('runs the fetcher and stores on a cold cache', async () => {
    const fetcher = vi.fn(async () => ['fresh']);
    const out = await getCached('k', 60_000, fetcher);
    expect(out).toEqual(['fresh']);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('serves stale data when the fetcher throws', async () => {
    store['k'] = { data: ['old'], fetched_at: new Date(0).toISOString() };
    const out = await getCached('k', 60_000, async () => { throw new Error('boom'); });
    expect(out).toEqual(['old']);
  });
});
