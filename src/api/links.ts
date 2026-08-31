import { readDoc, writeDoc } from '@/lib/docStore';
import type { LinkItem, Category, LinksEnvelope } from './types';
import { FAVORITES_CATEGORY_ID, OTHER_CATEGORY_ID } from './types';

/** Default pseudo-categories for a fresh installation. The UI renders these
 *  by id (see `lib/categoryName.ts`); older documents may still carry the
 *  English names "Favorites" / "Other", which is harmless. */
const DEFAULT_PSEUDO_CATEGORIES: Category[] = [
  { id: FAVORITES_CATEGORY_ID, name: 'Favoritter', order: 0 },
  { id: OTHER_CATEGORY_ID, name: 'Annet', order: 1_000_000 },
];

/**
 * Normalise whatever shape the `links` document holds into a v2 envelope.
 * - Legacy v1: bare LinkItem[] → wrap in { version: 2, links, categories: [...defaults] }
 * - v2: pass through, but backfill pseudo-categories if they're missing
 * - null/undefined: return empty envelope with defaults
 * - Dedupe categories by id (first occurrence wins)
 */
export function normaliseEnvelope(raw: LinkItem[] | LinksEnvelope | null | undefined): LinksEnvelope {
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
  for (const def of DEFAULT_PSEUDO_CATEGORIES) {
    if (!seen.has(def.id)) deduped.push({ ...def });
  }
  return { version: 2, links: raw.links ?? [], categories: deduped };
}

export const linksApi = {
  list: async (): Promise<LinksEnvelope> => {
    const raw = await readDoc<LinkItem[] | LinksEnvelope | null>('links', null);
    return normaliseEnvelope(raw);
  },
  saveAll: async (envelope: LinksEnvelope) => {
    await writeDoc('links', envelope);
    return { ok: true };
  },
};
