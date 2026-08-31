import { describe, it, expect } from 'vitest';
import type { CacheReader } from './cache';
import {
  buildWishlist,
  itadLookupKey,
  itadLookupTtl,
  wishlistCacheKey,
  ITAD_LOOKUP_HIT_TTL_MS,
  ITAD_LOOKUP_MISS_TTL_MS,
  WISHLIST_CONCURRENCY,
} from './wishlist';

function stubFetch(url: string) {
  const json = (o: unknown) => Promise.resolve({ ok: true, json: () => Promise.resolve(o), text: () => Promise.resolve('') } as Response);
  if (url.includes('GetWishlist')) return json({ response: { items: [
    { appid: 10, priority: 2, date_added: 100 },
    { appid: 20, priority: 1, date_added: 200 },
  ] } });
  if (url.includes('appdetails?appids=10')) return json({ '10': { success: true, data: { name: 'Alpha', price_overview: { discount_percent: 50, final: 9900, final_formatted: 'kr 99', initial_formatted: 'kr 199', currency: 'NOK' }, genres: [{ description: 'RPG' }] } } });
  if (url.includes('appdetails?appids=20')) return json({ '20': { success: true, data: { name: 'Beta', is_free: true, genres: [] } } });
  if (url.includes('lookup')) return json({ game: { id: 'itad-x' } });
  if (url.includes('history')) return json([{ deal: { cut: 50 } }, { deal: { cut: 30 } }]);
  return json({});
}

describe('buildWishlist', () => {
  it('maps, sorts by priority, and tags all-time-low sales as hot', async () => {
    const games = await buildWishlist({ steamKey: 'k', steamId: 's', itadKey: 'i' }, stubFetch as typeof fetch);
    expect(games.map((g) => g.appid)).toEqual(['20', '10']); // priority 1 before 2
    const alpha = games.find((g) => g.appid === '10')!;
    expect(alpha.onSale).toBe(true);
    expect(alpha.priceTag).toBe('hot'); // discount 50 >= best cut 50 - 5
    expect(games.find((g) => g.appid === '20')!.isFree).toBe(true);
  });
});

describe('buildWishlist ITAD optional', () => {
  it('skips ITAD lookups when itadKey is empty', async () => {
    const calls: string[] = [];
    const stub = (async (url: string) => {
      calls.push(url);
      const json = (o: unknown) => Promise.resolve({ ok: true, json: () => Promise.resolve(o), text: () => Promise.resolve('') } as Response);
      if (url.includes('GetWishlist')) return json({ response: { items: [{ appid: 10, priority: 1, date_added: 1 }] } });
      if (url.includes('appdetails')) return json({ '10': { success: true, data: { name: 'A', price_overview: { discount_percent: 60, final: 100, final_formatted: 'kr 1', initial_formatted: 'kr 2', currency: 'NOK' }, genres: [] } } });
      return json({});
    }) as unknown as typeof fetch;
    const games = await buildWishlist({ steamKey: 'k', steamId: 's', itadKey: '' }, stub);
    expect(games).toHaveLength(1);
    expect(games[0].itadId).toBeNull();
    expect(calls.some((u) => u.includes('isthereanydeal'))).toBe(false);
  });
});

describe('buildWishlist upstream failures', () => {
  const env = { steamKey: 'k', steamId: 's', itadKey: '' };

  it('throws instead of returning [] when GetWishlist is not ok', async () => {
    const stub = (async () =>
      ({ ok: false, status: 403, json: () => Promise.resolve({}), text: () => Promise.resolve('') }) as Response) as unknown as typeof fetch;
    await expect(buildWishlist(env, stub)).rejects.toThrow(/steam wishlist 403/);
  });

  it('throws when the GetWishlist body is not JSON', async () => {
    const stub = (async () =>
      ({ ok: true, status: 200, json: () => Promise.reject(new SyntaxError('Unexpected token <')), text: () => Promise.resolve('<html>') }) as Response) as unknown as typeof fetch;
    await expect(buildWishlist(env, stub)).rejects.toThrow(/parse failure/);
  });

  it('throws when the fetch itself rejects', async () => {
    const stub = (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;
    await expect(buildWishlist(env, stub)).rejects.toThrow('fetch failed');
  });

  it('throws when items is not an array', async () => {
    const stub = (async () =>
      ({ ok: true, status: 200, json: () => Promise.resolve({ response: { items: 'nope' } }), text: () => Promise.resolve('') }) as Response) as unknown as typeof fetch;
    await expect(buildWishlist(env, stub)).rejects.toThrow(/parse failure/);
  });

  it('returns [] for a genuinely empty wishlist', async () => {
    const stub = (async () =>
      ({ ok: true, status: 200, json: () => Promise.resolve({ response: { items: [] } }), text: () => Promise.resolve('') }) as Response) as unknown as typeof fetch;
    await expect(buildWishlist(env, stub)).resolves.toEqual([]);
  });
});

/** Stub upstream for N games, all on sale so every stage runs per game. */
function bigStub(n: number, onCall: (url: string) => Promise<void> = async () => {}) {
  const json = (o: unknown) => ({ ok: true, json: () => Promise.resolve(o), text: () => Promise.resolve('') }) as Response;
  const items = Array.from({ length: n }, (_, i) => ({ appid: 1000 + i, priority: i, date_added: i }));
  return (async (url: string) => {
    await onCall(url);
    if (url.includes('GetWishlist')) return json({ response: { items } });
    const m = /appids=(\d+)/.exec(url);
    if (m) return json({ [m[1]]: { success: true, data: { name: `Game ${m[1]}`, price_overview: { discount_percent: 40, final: 100, final_formatted: 'kr 1', initial_formatted: 'kr 2', currency: 'NOK' }, genres: [] } } });
    if (url.includes('lookup')) return json({ game: { id: `itad-${/appid=(\d+)/.exec(url)![1]}` } });
    if (url.includes('history')) return json([{ deal: { cut: 40 } }]);
    return json({});
  }) as unknown as typeof fetch;
}

describe('buildWishlist concurrency', () => {
  it('runs per-game stages with at most WISHLIST_CONCURRENCY calls in flight', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const stub = bigStub(30, async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
    });
    const games = await buildWishlist({ steamKey: 'k', steamId: 's', itadKey: 'i' }, stub);
    expect(games).toHaveLength(30);
    expect(games.map((g) => g.priority)).toEqual(Array.from({ length: 30 }, (_, i) => i));
    expect(games.every((g) => g.itadId === `itad-${g.appid}` && g.priceTag === 'hot')).toBe(true);
    expect(maxInFlight).toBeGreaterThan(1);
    expect(maxInFlight).toBeLessThanOrEqual(WISHLIST_CONCURRENCY);
  });

  it('keeps the other games when one appdetails call fails', async () => {
    const stub = bigStub(3, async (url) => { if (url.includes('appids=1001')) throw new TypeError('fetch failed'); });
    const games = await buildWishlist({ steamKey: 'k', steamId: 's', itadKey: '' }, stub);
    expect(games.map((g) => g.name)).toEqual(['Game 1000', '1001', 'Game 1002']);
  });
});

describe('buildWishlist ITAD lookup cache', () => {
  function memoryCache() {
    const store = new Map<string, unknown>();
    const ttls = new Map<string, number>();
    const cache: CacheReader = async (key, ttl, fetcher) => {
      if (store.has(key)) return store.get(key) as never;
      const data = await fetcher();
      store.set(key, data);
      ttls.set(key, typeof ttl === 'function' ? ttl(data) : ttl);
      return data;
    };
    return { cache, store, ttls };
  }

  it('only hits ITAD lookup for games missing from the cache', async () => {
    const { cache, store, ttls } = memoryCache();
    const calls: string[] = [];
    const stub = bigStub(4, async (url) => { calls.push(url); });
    const env = { steamKey: 'k', steamId: 's', itadKey: 'i' };

    await buildWishlist(env, stub, cache);
    expect(calls.filter((u) => u.includes('lookup'))).toHaveLength(4);
    expect(store.get(itadLookupKey('1000'))).toEqual({ id: 'itad-1000' });
    expect(ttls.get(itadLookupKey('1000'))).toBe(ITAD_LOOKUP_HIT_TTL_MS);

    calls.length = 0;
    const games = await buildWishlist(env, stub, cache);
    expect(calls.filter((u) => u.includes('lookup'))).toHaveLength(0);
    expect(games.every((g) => g.itadId === `itad-${g.appid}`)).toBe(true);
  });

  it('caches a miss with the shorter TTL and keeps itadId null', async () => {
    const { cache, store, ttls } = memoryCache();
    const stub = (async (url: string) => {
      const json = (o: unknown) => ({ ok: true, json: () => Promise.resolve(o), text: () => Promise.resolve('') }) as Response;
      if (url.includes('GetWishlist')) return json({ response: { items: [{ appid: 7, priority: 1, date_added: 1 }] } });
      if (url.includes('lookup')) return json({ game: null });
      return json({});
    }) as unknown as typeof fetch;
    const games = await buildWishlist({ steamKey: 'k', steamId: 's', itadKey: 'i' }, stub, cache);
    expect(games[0].itadId).toBeNull();
    expect(store.get(itadLookupKey('7'))).toEqual({ id: null });
    expect(ttls.get(itadLookupKey('7'))).toBe(ITAD_LOOKUP_MISS_TTL_MS);
  });

  it('does not cache a non-2xx lookup reply and keeps itadId null', async () => {
    const { cache, store } = memoryCache();
    const stub = (async (url: string) => {
      const json = (o: unknown) => ({ ok: true, json: () => Promise.resolve(o), text: () => Promise.resolve('') }) as Response;
      if (url.includes('GetWishlist')) return json({ response: { items: [{ appid: 7, priority: 1, date_added: 1 }] } });
      if (url.includes('lookup')) return { ok: false, status: 429, json: () => Promise.resolve({}), text: () => Promise.resolve('') } as Response;
      return json({});
    }) as unknown as typeof fetch;
    const games = await buildWishlist({ steamKey: 'k', steamId: 's', itadKey: 'i' }, stub, cache);
    expect(games).toHaveLength(1);
    expect(games[0].itadId).toBeNull();
    expect(store.has(itadLookupKey('7'))).toBe(false);
  });

  it('tolerates a cache that throws for one game', async () => {
    const cache: CacheReader = async (key, _ttl, fetcher) => {
      if (key === itadLookupKey('1001')) throw new Error('db down');
      return fetcher();
    };
    const games = await buildWishlist({ steamKey: 'k', steamId: 's', itadKey: 'i' }, bigStub(3), cache);
    expect(games.find((g) => g.appid === '1001')!.itadId).toBeNull();
    expect(games.find((g) => g.appid === '1000')!.itadId).toBe('itad-1000');
  });
});

describe('itadLookupTtl', () => {
  it('uses the long TTL for hits and the short one for misses', () => {
    expect(itadLookupTtl({ id: 'x' })).toBe(ITAD_LOOKUP_HIT_TTL_MS);
    expect(itadLookupTtl({ id: null })).toBe(ITAD_LOOKUP_MISS_TTL_MS);
    expect(ITAD_LOOKUP_MISS_TTL_MS).toBeLessThan(ITAD_LOOKUP_HIT_TTL_MS);
  });
});

describe('wishlistCacheKey', () => {
  it('scopes the key by user and linked Steam account', () => {
    expect(wishlistCacheKey('u1', '7656')).toBe('wishlist:u1:7656');
    expect(wishlistCacheKey('u1', '7656')).not.toBe(wishlistCacheKey('u1', '9999'));
    expect(wishlistCacheKey('u1', '7656')).not.toBe(wishlistCacheKey('u2', '7656'));
  });
});
