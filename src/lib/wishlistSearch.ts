import type { WishlistGame } from '@/api/types';

/** Unicode combining marks (the accents NFD splits off a base letter). */
const COMBINING_MARKS = /\p{M}/gu;

/**
 * Lower-case and strip diacritics so "Pokémon" matches "pokemon" and
 * "Blåfjell" matches "blafjell". NFD splits each accented letter into the
 * base letter plus a combining mark, which the regex removes.
 */
export function normaliseSearchText(text: string): string {
  return text.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
}

/** Split a query into normalised words, dropping blanks. */
export function searchWords(query: string): string[] {
  return normaliseSearchText(query.trim()).split(/\s+/).filter(Boolean);
}

/**
 * Filter wishlist games by a free-text query. Matches against the game
 * name and every genre; a multi-word query requires every word to match
 * (each word may hit a different field). An empty or whitespace-only
 * query returns the input list untouched.
 */
export function filterGames(games: WishlistGame[], query: string): WishlistGame[] {
  const words = searchWords(query);
  if (words.length === 0) return games;
  return games.filter((game) => {
    const haystacks = [game.name, ...game.genres].map(normaliseSearchText);
    return words.every((word) => haystacks.some((text) => text.includes(word)));
  });
}
