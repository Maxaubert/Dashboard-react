import type { WishlistGame } from '@/api/types';

/** Display metadata (css class + label) for a price tag, keyed by tag id. */
export const PTAG_LABEL: Record<string, { cls: string; label: string }> = {
  hot: { cls: 'ptag-hot', label: '🔥 Hot' },
  'rarely-on-sale': { cls: 'ptag-rare', label: '🔥 Rarely on Sale' },
};

/** Normalize a game's priceTag (string | string[] | null) into a string array. */
export function ptagsArr(g: WishlistGame): string[] {
  if (Array.isArray(g.priceTag)) return g.priceTag;
  if (g.priceTag) return [g.priceTag as string];
  return [];
}
