import type { Category, LinkItem } from '../api/types';
import { FAVORITES_CATEGORY_ID, OTHER_CATEGORY_ID } from '../api/types';

export type SectionRender =
  | { kind: 'favorites'; category: Category; links: LinkItem[] }
  | { kind: 'user'; category: Category; links: LinkItem[] }
  | { kind: 'other'; category: Category; links: LinkItem[] };

/**
 * Group links into ordered sections for rendering.
 *
 * Rules:
 * - Favorites: links with `favorite === true`. Trumps the link's own category.
 * - Other: links without a category, or with a category id that doesn't exist.
 * - User: links with a valid category id and favorite !== true.
 * - Sections are ordered ascending by `Category.order`. Empty sections are omitted.
 */
export function groupLinks(links: LinkItem[], categories: Category[]): SectionRender[] {
  const byId = new Map<string, Category>();
  for (const c of categories) byId.set(c.id, c);

  const favorites: LinkItem[] = [];
  const perUser = new Map<string, LinkItem[]>();
  const other: LinkItem[] = [];

  for (const l of links) {
    if (l.favorite === true) {
      favorites.push(l);
      continue;
    }
    if (
      l.category &&
      byId.has(l.category) &&
      l.category !== FAVORITES_CATEGORY_ID &&
      l.category !== OTHER_CATEGORY_ID
    ) {
      const bucket = perUser.get(l.category) ?? [];
      bucket.push(l);
      perUser.set(l.category, bucket);
      continue;
    }
    other.push(l);
  }

  const sorted = [...categories].sort((a, b) => a.order - b.order);

  const out: SectionRender[] = [];
  for (const c of sorted) {
    if (c.id === FAVORITES_CATEGORY_ID) {
      if (favorites.length > 0) out.push({ kind: 'favorites', category: c, links: favorites });
    } else if (c.id === OTHER_CATEGORY_ID) {
      if (other.length > 0) out.push({ kind: 'other', category: c, links: other });
    } else {
      const bucket = perUser.get(c.id);
      if (bucket && bucket.length > 0) out.push({ kind: 'user', category: c, links: bucket });
    }
  }
  return out;
}
