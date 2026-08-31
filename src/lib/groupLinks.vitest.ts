import { describe, expect, it } from 'vitest';
import { groupLinks } from './groupLinks';
import type { Category, LinkItem } from '@/api/types';
import { FAVORITES_CATEGORY_ID, OTHER_CATEGORY_ID } from '@/api/types';

const L = (id: string, opts: Partial<LinkItem> = {}): LinkItem => ({
  id,
  url: `https://example.com/${id}`,
  name: id,
  ...opts,
});
const favCat: Category = { id: FAVORITES_CATEGORY_ID, name: 'Favorites', order: 0 };
const otherCat: Category = { id: OTHER_CATEGORY_ID, name: 'Other', order: 1_000_000 };
const dev: Category = { id: 'dev', name: 'Dev', order: 10 };
const media: Category = { id: 'media', name: 'Media', order: 20 };

const sectionIds = (out: ReturnType<typeof groupLinks>) =>
  out.map((s) => (s.kind === 'user' ? s.category.id : s.kind));

describe('groupLinks', () => {
  it('returns [] for empty input', () => {
    expect(groupLinks([], [])).toEqual([]);
  });

  it('hides the favorites / other pseudo categories when no links belong to them', () => {
    expect(groupLinks([], [favCat, otherCat])).toEqual([]);
  });

  it('puts all uncategorized links in a single Other section', () => {
    const out = groupLinks([L('a'), L('b')], [favCat, otherCat]);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('other');
    expect(out[0].links.map((l) => l.id)).toEqual(['a', 'b']);
  });

  it('lets favorites trump the user category without duplication', () => {
    const links = [L('a', { favorite: true, category: 'dev' }), L('b', { category: 'dev' })];
    const out = groupLinks(links, [favCat, dev, otherCat]);
    expect(out).toHaveLength(2);
    expect(out[0].kind).toBe('favorites');
    expect(out[0].links.map((l) => l.id)).toEqual(['a']);
    expect(out[1].kind).toBe('user');
    expect(out[1].links.map((l) => l.id)).toEqual(['b']);
  });

  it('orders sections by Category.order', () => {
    const links = [L('x', { category: 'media' }), L('y', { category: 'dev' })];
    const out = groupLinks(links, [favCat, dev, media, otherCat]);
    expect(sectionIds(out)).toEqual(['dev', 'media']);
  });

  it('renders Other after user categories when mixed', () => {
    const links = [L('a', { category: 'dev' }), L('b')];
    const out = groupLinks(links, [favCat, dev, otherCat]);
    expect(sectionIds(out)).toEqual(['dev', 'other']);
  });

  it('reorders pseudo-categories by their order field', () => {
    const reorderedFav: Category = { ...favCat, order: 50 };
    const reorderedOther: Category = { ...otherCat, order: 5 };
    const links = [L('a', { favorite: true }), L('b'), L('c', { category: 'dev' })];
    const out = groupLinks(links, [reorderedOther, dev, reorderedFav]);
    expect(out.map((s) => s.kind)).toEqual(['other', 'user', 'favorites']);
  });

  it('falls back to Other for an orphan category id', () => {
    const out = groupLinks([L('a', { category: 'ghost-id' })], [favCat, otherCat]);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('other');
  });
});
