/**
 * Response shapes produced by the Vercel functions. The frontend re-exports
 * these from `src/api/types.ts`; nothing under `api/` may import from `src/`.
 */

// --- Wishlist (/api/wishlist) -------------------------------------------

export type PriceTag = 'hot' | null;

export interface WishlistGame {
  appid: string;
  name: string;
  imgUrl: string;
  imgFallback: string;
  storeUrl: string;
  isFree: boolean;
  /** Localized current price like "kr 199,00", or null when free. */
  price: string | null;
  /** Original price string when on sale, "" otherwise. */
  origPrice: string;
  /** Discount percentage 0-100. */
  discount: number;
  onSale: boolean;
  genres: string[];
  /** Steam wishlist position (lower = higher priority). */
  priority: number;
  /** Unix timestamp the user added it. */
  dateAdded: number;
  /** Price in minor units (ore). */
  priceInt: number;
  currency: string;
  /** "hot" when current discount matches the historical all-time-low. */
  priceTag: PriceTag;
  /** IsThereAnyDeal game id used for the price history modal. */
  itadId: string | null;
}

// --- News (/api/news) ---------------------------------------------------

export interface NewsItem {
  link: string;
  title: string;
  desc: string;
  img: string;
}
