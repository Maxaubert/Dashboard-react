/**
 * Shared API types — mirror the response shapes returned by the Python
 * backend (api.py and server/notes_api.py).
 *
 * If you change a type here you should also confirm the backend produces
 * that field. The Python side has no schema enforcement so type drift is
 * caught only when a page actually consumes the field.
 */

// ─── Auth ────────────────────────────────────────────────────────────────

/** The current user, as returned by /api/auth/{me,login,signup}. */
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
  /** True when the user has pinned this todo to the home page as a widget. */
  pinned?: boolean;
  /** ISO timestamp the todo was marked done. Used to auto-purge after 7 days. */
  completedAt?: string | null;
}

// ─── Plan (weekly schedule) ──────────────────────────────────────────────

export interface PlanPdfLink {
  /** Display label, e.g. "Lab 3". */
  label: string;
  /** Either an embedded reference (lab number) or a stat name. */
  lab?: string;
  stat?: string;
}

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
  pdfLinks?: PlanPdfLink[];
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
 *   - `__favorites` — rendered as "★ Favorites" (membership = links with favorite === true)
 *   - `__other`     — rendered as "Other"      (membership = links with no `category` set)
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
 * v2 envelope for /api/links. The backend accepts both v1 (bare array)
 * and v2 (this shape) on read, and always writes v2 on save.
 */
export interface LinksEnvelope {
  version: 2;
  links: LinkItem[];
  categories: Category[];
}

// ─── Notes ───────────────────────────────────────────────────────────────

export interface Note {
  id: string;
  title: string;
  body: string;
  /**
   * Last-modified timestamp. Legacy stores `Date.now()` (number);
   * older entries may be ISO strings. The Notes page sort tolerates both.
   */
  updatedAt: number | string;
}

// ─── Skole (university) ──────────────────────────────────────────────────

export interface SkoleAssignment {
  id: number | null;
  title: string;
  /** ISO 8601 — may be null when Canvas has no due date. */
  due_at: string | null;
  submitted: boolean;
  html_url: string;
}

export interface SkoleCourse {
  id: number;
  name: string;
  /** Short code, e.g. "STAT", "PARA". */
  short: string;
  color: string;
  /** Number of submitted assignments. */
  submitted: number;
  /** Expected total assignments (may exceed assignments.length). */
  total: number;
  assignments: SkoleAssignment[];
}

export interface SkoleAnnouncement {
  title: string;
  /** ISO 8601 string. */
  posted_at: string;
  html_url: string;
  course_name: string;
  course_short: string;
  course_color: string;
}

export interface SkoleData {
  courses: SkoleCourse[];
  announcements: SkoleAnnouncement[];
}

// ─── Wishlist (gaming) ───────────────────────────────────────────────────

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
  /** Price in minor units (øre). */
  priceInt: number;
  currency: string;
  /** "hot" when current discount matches the historical all-time-low. */
  priceTag: PriceTag;
  /** IsThereAnyDeal game id used for the price history modal. */
  itadId: string | null;
}

// ─── News (VG.no front page) ─────────────────────────────────────────────

export interface NewsItem {
  link: string;
  title: string;
  desc: string;
  img: string;
}

// ─── Generic ─────────────────────────────────────────────────────────────

export interface ApiOk {
  ok: true;
}

export interface ApiError {
  ok: false;
  error: string;
}

// ─── Home page ───────────────────────────────────────────────────────────────

/** Single envelope for all home-page server-persisted data. */
export interface HomeEnvelope {
  version: 1;
  /** Section IDs in the order they render on the home page. */
  sections: string[];
  widgets: HomeWidget[];
  habits: HomeHabit[];
}

/** Persisted widget tile (NOT the timer runtime state). */
export interface HomeWidget {
  id: string;
  type: 'habit' | 'countdown' | 'pomodoro' | 'stopwatch' | 'alarm' | 'todo';
  refId: string;
}

/** Persisted habit. Matches the existing `Habit` type in useHabits.ts. */
export interface HomeHabit {
  id: string;
  name: string;
  color: string;
  /** ISO "YYYY-MM-DD" strings. */
  completedDays: string[];
  /** ISO timestamp. */
  createdAt: string;
}
