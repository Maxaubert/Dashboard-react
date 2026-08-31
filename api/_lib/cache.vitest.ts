import { describe, it, expect, vi, beforeEach } from 'vitest';

const store: Record<string, { data: unknown; fetched_at: string }> = {};
vi.mock('./supabaseAdmin.js', () => ({
  admin: {
    from: () => ({
      select: () => ({
        eq: (_col: string, key: string) => ({
          maybeSingle: async () => ({ data: store[key] ?? null, error: null }),
        }),
      }),
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
    expect(store['k']?.data).toEqual(['fresh']);
  });

  it('serves a fresh row without calling the fetcher', async () => {
    store['k'] = { data: ['cached'], fetched_at: new Date().toISOString() };
    const fetcher = vi.fn(async () => ['fresh']);
    const out = await getCached('k', 60_000, fetcher);
    expect(out).toEqual(['cached']);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('serves stale data when the fetcher throws', async () => {
    store['k'] = { data: ['old'], fetched_at: new Date(0).toISOString() };
    const out = await getCached('k', 60_000, async () => { throw new Error('boom'); });
    expect(out).toEqual(['old']);
  });

  it('does not overwrite a stale row when the fetcher throws', async () => {
    const stale = { data: ['old'], fetched_at: new Date(0).toISOString() };
    store['k'] = { ...stale };
    await getCached('k', 60_000, async () => { throw new Error('boom'); });
    expect(store['k']).toEqual(stale);
  });

  it('rethrows and stores nothing when the cache is cold and the fetcher throws', async () => {
    await expect(getCached('k', 60_000, async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    expect(store['k']).toBeUndefined();
  });

  it('lets the TTL depend on the cached value', async () => {
    const ttl = (data: { id: string | null }) => (data.id ? 60_000 : 1_000);
    store['k'] = { data: { id: null }, fetched_at: new Date(Date.now() - 5_000).toISOString() };
    const fetcher = vi.fn(async () => ({ id: 'found' }));
    // A 5s-old null row is past its 1s TTL, so the fetcher runs.
    expect(await getCached('k', ttl, fetcher)).toEqual({ id: 'found' });
    expect(fetcher).toHaveBeenCalledOnce();
    // The stored hit is now within its 60s TTL, so the fetcher does not run again.
    expect(await getCached('k', ttl, fetcher)).toEqual({ id: 'found' });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('keeps rows for different keys independent', async () => {
    store['wishlist:u:old'] = { data: ['old-account'], fetched_at: new Date().toISOString() };
    const fetcher = vi.fn(async () => ['new-account']);
    const out = await getCached('wishlist:u:new', 60_000, fetcher);
    expect(out).toEqual(['new-account']);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(store['wishlist:u:old']?.data).toEqual(['old-account']);
  });
});
