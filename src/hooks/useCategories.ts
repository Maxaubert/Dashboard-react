import { useCallback } from 'react';
import { useLinks, useSaveLinks } from './useLinks';
import type { Category, LinkItem, LinksEnvelope } from '@/api/types';
import { FAVORITES_CATEGORY_ID, OTHER_CATEGORY_ID } from '@/api/types';

/**
 * Generate a stable id for a new user category. Uses crypto.randomUUID when
 * available (modern browsers + Node 19+) and falls back to a timestamp suffix.
 */
function generateCategoryId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `cat_${crypto.randomUUID()}`;
  }
  return `cat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Next available order value: 10 units higher than the current max (excluding __other). */
function nextUserOrder(categories: Category[]): number {
  const userAndFavs = categories.filter((c) => c.id !== OTHER_CATEGORY_ID);
  const max = userAndFavs.reduce((m, c) => Math.max(m, c.order), -1);
  return max + 10;
}

export interface UseCategoriesResult {
  categories: Category[];
  /** Create a user category with a given name. Returns the new id. */
  create: (name: string) => string;
  /** Rename an existing category (by id). No-op on pseudo-categories. */
  rename: (id: string, nextName: string) => void;
  /** Delete a user category and orphan its links to Other. No-op on pseudo. */
  remove: (id: string) => void;
  /** Reorder categories by providing a new full ordering of ids. */
  reorder: (orderedIds: string[]) => void;
}

export function useCategories(): UseCategoriesResult {
  const { data } = useLinks();
  const saveLinks = useSaveLinks();

  const envelope: LinksEnvelope = data ?? { version: 2, links: [], categories: [] };

  const persist = useCallback(
    (next: LinksEnvelope) => saveLinks.mutate(next),
    [saveLinks],
  );

  const create = useCallback(
    (name: string): string => {
      const trimmed = name.trim();
      if (!trimmed) return '';
      const id = generateCategoryId();
      const now = Date.now();
      const newCat: Category = {
        id,
        name: trimmed,
        order: nextUserOrder(envelope.categories),
        createdAt: now,
        updatedAt: now,
      };
      persist({ ...envelope, categories: [...envelope.categories, newCat] });
      return id;
    },
    [envelope, persist],
  );

  const rename = useCallback(
    (id: string, nextName: string) => {
      if (id === FAVORITES_CATEGORY_ID || id === OTHER_CATEGORY_ID) return;
      const trimmed = nextName.trim();
      if (!trimmed) return;
      const nextCats = envelope.categories.map((c) =>
        c.id === id ? { ...c, name: trimmed, updatedAt: Date.now() } : c,
      );
      persist({ ...envelope, categories: nextCats });
    },
    [envelope, persist],
  );

  const remove = useCallback(
    (id: string) => {
      if (id === FAVORITES_CATEGORY_ID || id === OTHER_CATEGORY_ID) return;
      const nextCats = envelope.categories.filter((c) => c.id !== id);
      // Orphan any links referencing this category — they fall back to Other.
      const nextLinks: LinkItem[] = envelope.links.map((l) =>
        l.category === id ? { ...l, category: undefined, updatedAt: Date.now() } : l,
      );
      persist({ ...envelope, links: nextLinks, categories: nextCats });
    },
    [envelope, persist],
  );

  const reorder = useCallback(
    (orderedIds: string[]) => {
      const idIndex = new Map<string, number>();
      orderedIds.forEach((id, i) => idIndex.set(id, (i + 1) * 10));
      const nextCats = envelope.categories.map((c) => {
        const fresh = idIndex.get(c.id);
        return fresh === undefined ? c : { ...c, order: fresh, updatedAt: Date.now() };
      });
      persist({ ...envelope, categories: nextCats });
    },
    [envelope, persist],
  );

  return { categories: envelope.categories, create, rename, remove, reorder };
}
