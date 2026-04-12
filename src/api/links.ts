import { api } from './client';
import type { LinkItem, Category, LinksEnvelope } from './types';
import { FAVORITES_CATEGORY_ID, OTHER_CATEGORY_ID } from './types';

/** Default pseudo-categories for a fresh installation. */
const DEFAULT_PSEUDO_CATEGORIES: Category[] = [
  { id: FAVORITES_CATEGORY_ID, name: 'Favorites', order: 0 },
  { id: OTHER_CATEGORY_ID, name: 'Other', order: 1_000_000 },
];

/**
 * Normalise whatever shape the backend returns into a v2 envelope.
 * - Legacy v1: bare LinkItem[] → wrap in { version: 2, links, categories: [...defaults] }
 * - v2: pass through, but backfill pseudo-categories if they're missing
 * - null/undefined: return empty envelope with defaults
 * - Dedupe categories by id (first occurrence wins)
 */
function normaliseEnvelope(raw: LinkItem[] | LinksEnvelope | null | undefined): LinksEnvelope {
  if (raw == null) {
    return { version: 2, links: [], categories: [...DEFAULT_PSEUDO_CATEGORIES] };
  }
  if (Array.isArray(raw)) {
    return { version: 2, links: raw, categories: [...DEFAULT_PSEUDO_CATEGORIES] };
  }
  // Dedupe by id (first occurrence wins), then backfill missing pseudo-categories.
  const seen = new Set<string>();
  const deduped: Category[] = [];
  for (const c of raw.categories ?? []) {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      deduped.push(c);
    }
  }
  if (!seen.has(FAVORITES_CATEGORY_ID)) {
    deduped.push({ id: FAVORITES_CATEGORY_ID, name: 'Favorites', order: 0 });
  }
  if (!seen.has(OTHER_CATEGORY_ID)) {
    deduped.push({ id: OTHER_CATEGORY_ID, name: 'Other', order: 1_000_000 });
  }
  return { version: 2, links: raw.links ?? [], categories: deduped };
}

export const linksApi = {
  list: async (): Promise<LinksEnvelope> => {
    const raw = await api.get<LinkItem[] | LinksEnvelope | null | undefined>('/links');
    return normaliseEnvelope(raw);
  },
  saveAll: (envelope: LinksEnvelope) =>
    api.post<{ ok: boolean }>('/links', envelope),
};
