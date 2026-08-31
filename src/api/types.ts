/**
 * Shared API types — mirror the Supabase row shapes and the `api/`
 * serverless function responses.
 *
 * If you change a type here, confirm the Supabase table column or function
 * response still produces that field. The schema lives in
 * `supabase/migrations/` and type drift is caught only at runtime.
 */

// ─── Auth ────────────────────────────────────────────────────────────────

/** The current user, mapped from the Supabase Auth user by `mapUser` in `src/api/auth.ts`. */
export interface User {
  id: string;
  email: string;
  display_name: string;
}

// ─── Todos ───────────────────────────────────────────────────────────────

export type Priority = 'high' | 'medium' | 'low';

export interface Todo {
  id: string;
  /** Task title — legacy field is `text`, not `title`. */
  text: string;
  priority: Priority;
  /** ISO 8601 date string (YYYY-MM-DD). Optional. */
  deadline?: string | null;
  done: boolean;
  /** ISO timestamp the todo was marked done. Used to auto-purge after 7 days. */
  completedAt?: string | null;
}

// ─── Plan (weekly schedule) ──────────────────────────────────────────────

export interface PlanItem {
  id: string;
  title: string;
  /** Optional category badge ("Eksamen", "Lab 5", etc.). */
  tag?: string;
  /** When true the item appears every selected weekday; when false on `date`. */
  recurring: boolean;
  /** ISO date "YYYY-MM-DD" for non-recurring items. */
  date?: string;
  /** Selected weekdays for recurring items. 0 = Monday … 6 = Sunday. */
  days?: number[];
  /** "HH:MM" 24h. */
  startTime: string;
  endTime: string;
  location?: string;
  /** Hex color shown as the left bar / accent. */
  color?: string;
}

// ─── Links library ───────────────────────────────────────────────────────

export type LinkIconType = 'favicon' | 'svg' | 'emoji' | 'image';

/**
 * Link object — matches the legacy `links.json` schema EXACTLY (flat
 * `iconType` / `iconValue` fields, no nested `icon` object, no `order`
 * field — order is positional in the array).
 *
 * `iconValue` semantics:
 *   - favicon: empty string OR a domain override (renderer falls back
 *              to extracting the domain from `url` if empty).
 *   - svg:     id from the SVG_ICONS catalog.
 *   - emoji:   the emoji character.
 *   - image:   a `data:image/png;base64,…` URL or http URL.
 */
export interface LinkItem {
  id: string;
  url: string;
  name: string;
  sub?: string;
  /** Card accent color (hex). Falls back to the default purple. */
  color?: string;
  iconType?: LinkIconType;
  iconValue?: string;
  favorite?: boolean;
  /** Category id. Undefined → renders in the synthetic "__other" section. */
  category?: string;
  createdAt?: number;
  updatedAt?: number;
}

/**
 * A category groups links under a named section on the Lenker page.
 * Two reserved ids anchor the derived sections:
 *   - `__favorites`: rendered as "★ Favoritter" (membership = links with favorite === true)
 *   - `__other`:     rendered as "Annet"        (membership = links with no `category` set)
 * Display names come from `lib/categoryName.ts` (by id), not the stored `name`.
 * Reserved ids exist only to give those derived sections a position in the
 * drag order; their membership is always computed at render time.
 */
export interface Category {
  id: string;
  name: string;
  /** Ascending sort key — lower numbers render higher on the page. */
  order: number;
  createdAt?: number;
  updatedAt?: number;
}

export const FAVORITES_CATEGORY_ID = '__favorites';
export const OTHER_CATEGORY_ID = '__other';

/**
 * v2 envelope stored in the `links` document (`documents` table, via
 * `src/lib/docStore.ts`). `normaliseEnvelope` accepts both v1 (bare array)
 * and v2 (this shape) on read, and the client always writes v2 on save.
 */
export interface LinksEnvelope {
  version: 2;
  links: LinkItem[];
  categories: Category[];
}


// ─── Function responses (wishlist, news) ─────────────────────────────────

/**
 * Owned by `api/_lib/types.ts` so the serverless functions never import
 * from `src/`. Re-exported here for the frontend.
 */
export type { NewsItem, PriceTag, WishlistGame } from '../../api/_lib/types';

// ─── Home page ───────────────────────────────────────────────────────────────

/**
 * Single envelope for all home-page server-persisted data. Stored rows may
 * still carry the removed `widgets` / `habits` arrays; `normaliseHome`
 * drops them on read.
 */
export interface HomeEnvelope {
  version: 1;
  /** Section IDs in the order they render on the home page. */
  sections: string[];
  /** Section IDs the user has hidden via Settings. Empty = all visible. */
  hidden: string[];
}
