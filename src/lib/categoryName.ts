import type { Category } from '@/api/types';
import { FAVORITES_CATEGORY_ID, OTHER_CATEGORY_ID } from '@/api/types';

export const FAVORITES_LABEL = 'Favoritter';
export const OTHER_LABEL = 'Annet';

/**
 * Display name for a category. The two pseudo categories are resolved by id,
 * never by the stored `name`: older installs persisted them as "Favorites" /
 * "Other" in the links document, and the UI is nb-NO.
 */
export function categoryDisplayName(category: Pick<Category, 'id' | 'name'>): string {
  if (category.id === FAVORITES_CATEGORY_ID) return FAVORITES_LABEL;
  if (category.id === OTHER_CATEGORY_ID) return OTHER_LABEL;
  return category.name;
}

/** Section header title on the Lenker page (favorites carry the star). */
export function sectionTitle(category: Pick<Category, 'id' | 'name'>): string {
  const name = categoryDisplayName(category);
  return category.id === FAVORITES_CATEGORY_ID ? `★ ${name}` : name;
}
