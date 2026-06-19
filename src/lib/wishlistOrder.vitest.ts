import { describe, it, expect } from 'vitest';
import { orderForCarousel } from './wishlistOrder';
import type { WishlistGame } from '@/api/types';

function g(p: Partial<WishlistGame> & { appid: string }): WishlistGame {
  return {
    appid: p.appid, name: p.appid, imgUrl: '', imgFallback: '', storeUrl: '',
    isFree: false, price: null, origPrice: '', discount: p.discount ?? 0,
    onSale: p.onSale ?? false, genres: [], priority: p.priority ?? 0,
    dateAdded: 0, priceInt: 0, currency: 'NOK', priceTag: null, itadId: null,
  };
}

describe('orderForCarousel', () => {
  it('puts on-sale games first, sorted by discount desc', () => {
    const out = orderForCarousel([
      g({ appid: 'a', priority: 1 }),
      g({ appid: 'b', onSale: true, discount: 20 }),
      g({ appid: 'c', onSale: true, discount: 60 }),
    ]);
    expect(out.map((x) => x.appid)).toEqual(['c', 'b', 'a']);
  });
  it('sorts the non-sale remainder by priority asc', () => {
    const out = orderForCarousel([
      g({ appid: 'a', priority: 3 }),
      g({ appid: 'b', priority: 1 }),
      g({ appid: 'c', priority: 2 }),
    ]);
    expect(out.map((x) => x.appid)).toEqual(['b', 'c', 'a']);
  });
  it('returns [] for empty input', () => {
    expect(orderForCarousel([])).toEqual([]);
  });
});
