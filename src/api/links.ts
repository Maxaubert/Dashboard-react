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
 */
function normaliseEnvelope(raw: LinkItem[] | LinksEnvelope): LinksEnvelope {
  if (Array.isArray(raw)) {
    return { version: 2, links: raw, categories: [...DEFAULT_PSEUDO_CATEGORIES] };
  }
  const cats = raw.categories ?? [];
  const hasFavs = cats.some((c) => c.id === FAVORITES_CATEGORY_ID);
  const hasOther = cats.some((c) => c.id === OTHER_CATEGORY_ID);
  const backfilled: Category[] = [...cats];
  if (!hasFavs) backfilled.push({ id: FAVORITES_CATEGORY_ID, name: 'Favorites', order: 0 });
  if (!hasOther) backfilled.push({ id: OTHER_CATEGORY_ID, name: 'Other', order: 1_000_000 });
  return { version: 2, links: raw.links ?? [], categories: backfilled };
}

export const linksApi = {
  list: async (): Promise<LinksEnvelope> => {
    const raw = await api.get<LinkItem[] | LinksEnvelope>('/links');
    return normaliseEnvelope(raw);
  },
  saveAll: (envelope: LinksEnvelope) =>
    api.post<{ ok: boolean }>('/links', envelope),
};
