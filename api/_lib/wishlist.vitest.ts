import { describe, it, expect } from 'vitest';
import { buildWishlist } from './wishlist';

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
