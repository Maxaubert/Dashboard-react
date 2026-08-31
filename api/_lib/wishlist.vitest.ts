import { describe, it, expect } from 'vitest';
import { buildWishlist, wishlistCacheKey } from './wishlist';

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

describe('wishlistCacheKey', () => {
  it('scopes the key by user and linked Steam account', () => {
    expect(wishlistCacheKey('u1', '7656')).toBe('wishlist:u1:7656');
    expect(wishlistCacheKey('u1', '7656')).not.toBe(wishlistCacheKey('u1', '9999'));
    expect(wishlistCacheKey('u1', '7656')).not.toBe(wishlistCacheKey('u2', '7656'));
  });
});
