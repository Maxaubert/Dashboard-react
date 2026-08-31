import { describe, expect, it } from 'vitest';
import type { WishlistGame } from '@/api/types';
import { filterGames, normaliseSearchText, searchWords } from './wishlistSearch';

function game(name: string, genres: string[] = []): WishlistGame {
  return {
    appid: name,
    name,
    imgUrl: '',
    imgFallback: '',
    storeUrl: '',
    isFree: false,
    price: null,
    origPrice: '',
    discount: 0,
    onSale: false,
    genres,
    priority: 0,
    dateAdded: 0,
    priceInt: 0,
    currency: 'NOK',
    priceTag: null,
    itadId: null,
  } as WishlistGame;
}

const games = [
  game('Hollow Knight: Silksong', ['Action', 'Metroidvania']),
  game('Pokémon Trading Card Game', ['Card Game', 'Strategy']),
  game('Blåfjell Adventure', ['Adventure']),
  game('Cities: Skylines II', ['Simulation', 'City Builder']),
];

describe('normaliseSearchText', () => {
  it('lower-cases and strips diacritics', () => {
    expect(normaliseSearchText('Pokémon BLÅfjell Ñ')).toBe('pokemon blafjell n');
  });
});

describe('searchWords', () => {
  it('trims, splits on whitespace and drops blanks', () => {
    expect(searchWords('  Card   game ')).toEqual(['card', 'game']);
    expect(searchWords('   ')).toEqual([]);
  });
});

describe('filterGames', () => {
  it('returns the same list for an empty or blank query', () => {
    expect(filterGames(games, '')).toBe(games);
    expect(filterGames(games, '   ')).toBe(games);
  });

  it('matches the name case-insensitively', () => {
    expect(filterGames(games, 'silkSONG').map((g) => g.name)).toEqual(['Hollow Knight: Silksong']);
  });

  it('matches any genre', () => {
    expect(filterGames(games, 'metroid').map((g) => g.name)).toEqual(['Hollow Knight: Silksong']);
    expect(filterGames(games, 'strategy').map((g) => g.name)).toEqual(['Pokémon Trading Card Game']);
  });

  it('is accent-insensitive in both directions', () => {
    expect(filterGames(games, 'pokemon')).toHaveLength(1);
    expect(filterGames(games, 'pokémon')).toHaveLength(1);
    expect(filterGames(games, 'blafjell')).toHaveLength(1);
    expect(filterGames(games, 'BLÅFJELL')).toHaveLength(1);
  });

  it('requires every word of a multi-word query to match, across fields', () => {
    expect(filterGames(games, 'hollow action').map((g) => g.name)).toEqual(['Hollow Knight: Silksong']);
    expect(filterGames(games, 'hollow strategy')).toHaveLength(0);
    expect(filterGames(games, 'city sim').map((g) => g.name)).toEqual(['Cities: Skylines II']);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterGames(games, 'zelda')).toEqual([]);
  });
});
