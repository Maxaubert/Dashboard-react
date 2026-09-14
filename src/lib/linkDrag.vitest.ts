import { describe, expect, it } from 'vitest';
import type { Category, LinkItem } from '@/api/types';
import { FAVORITES_CATEGORY_ID, OTHER_CATEGORY_ID } from '@/api/types';
import { groupLinks, type SectionRender } from './groupLinks';
import { applyLinkDrop, linkDragId, moveLinkPreview } from './linkDrag';

const categories: Category[] = [
  { id: FAVORITES_CATEGORY_ID, name: 'Favoritter', order: 0 },
  { id: 'dev', name: 'Utvikling', order: 1 },
  { id: 'media', name: 'Medier', order: 2 },
  { id: OTHER_CATEGORY_ID, name: 'Annet', order: 3 },
];
const link = (id: string, overrides: Partial<LinkItem> = {}): LinkItem => ({
  id, name: id, url: `https://example.com/${id}`, ...overrides,
});
const links = [
  link('github', { category: 'dev', favorite: true }),
  link('docs', { category: 'dev' }),
  link('youtube', { category: 'media', favorite: true }),
  link('other'),
];
const section = (id: string, items = links): SectionRender =>
  groupLinks(items, categories).find((entry) => entry.category.id === id)!;

describe('link drag identity', () => {
  it('uses separate IDs for favorite and category copies, including unusual IDs', () => {
    expect(linkDragId('dev', 'github')).not.toBe(linkDragId(FAVORITES_CATEGORY_ID, 'github'));
    expect(linkDragId('a:b', 'c')).not.toBe(linkDragId('a', 'b:c'));
  });

  it('keeps the dragged copy ID stable after moving to a new section', () => {
    const id = linkDragId(FAVORITES_CATEGORY_ID, 'github');
    const active = { id, linkId: 'github', sectionId: 'media' };
    expect(linkDragId('media', 'github', active)).toBe(id);
    expect(linkDragId('dev', 'github', active)).not.toBe(id);
  });
});

describe('link drag preview', () => {
  it('moves into a section already containing the other copy without duplicating it', () => {
    const active = { id: linkDragId(FAVORITES_CATEGORY_ID, 'github'), linkId: 'github', sectionId: FAVORITES_CATEGORY_ID };
    const sections = groupLinks(links, categories);
    const preview = moveLinkPreview(sections, active, 'dev', 'docs');
    expect(preview.find((entry) => entry.category.id === 'dev')!.links.map((item) => item.id))
      .toEqual(['github', 'docs']);
    expect(preview.find((entry) => entry.kind === 'favorites')!.links.map((item) => item.id))
      .toEqual(['youtube']);
    expect(sections.find((entry) => entry.kind === 'favorites')!.links).toHaveLength(2);
  });

  it('leaves the favorites copy present when moving the category copy', () => {
    const active = { id: linkDragId('dev', 'github'), linkId: 'github', sectionId: 'dev' };
    const preview = moveLinkPreview(groupLinks(links, categories), active, 'media', 'youtube');
    expect(preview.find((entry) => entry.kind === 'favorites')!.links.map((item) => item.id))
      .toEqual(['github', 'youtube']);
    expect(preview.find((entry) => entry.category.id === 'media')!.links.map((item) => item.id))
      .toEqual(['github', 'youtube']);
  });
});

describe('link drop persistence', () => {
  it('reorders favorites without duplicating stored links or changing category membership', () => {
    const destination = section(FAVORITES_CATEGORY_ID);
    destination.links.reverse();
    const result = applyLinkDrop(links, destination, 'youtube', 123);
    expect(result.map((item) => item.id)).toEqual(['youtube', 'docs', 'github', 'other']);
    expect(new Set(result.map((item) => item.id)).size).toBe(links.length);
    expect(result.find((item) => item.id === 'github')).toEqual(links[0]);
    expect(result[0]).toEqual({ ...links[2], updatedAt: 123 });
  });

  it('marks a link favorite without changing its original category', () => {
    const destination = section(FAVORITES_CATEGORY_ID);
    destination.links.push(links[1]);
    const result = applyLinkDrop(links, destination, 'docs', 123);
    expect(result.find((item) => item.id === 'docs')).toMatchObject({ category: 'dev', favorite: true });
    expect(result).toHaveLength(links.length);
    expect(section('dev', result).links.map((item) => item.id)).toEqual(['github', 'docs']);
  });

  it('moves a favorite to a new category while keeping it in Favorites', () => {
    const destination = section('media');
    destination.links.unshift(links[0]);
    const result = applyLinkDrop(links, destination, 'github', 123);
    expect(result.find((item) => item.id === 'github')).toMatchObject({ category: 'media', favorite: true });
    expect(section(FAVORITES_CATEGORY_ID, result).links.map((item) => item.id)).toEqual(['github', 'youtube']);
    expect(section('dev', result).links.map((item) => item.id)).toEqual(['docs']);
    expect(result).toHaveLength(links.length);
  });

  it('moves a favorite into Other without removing its favorite status', () => {
    const destination = section(OTHER_CATEGORY_ID);
    destination.links.push(links[0]);
    const result = applyLinkDrop(links, destination, 'github', 123);
    expect(result.find((item) => item.id === 'github')).toMatchObject({ category: undefined, favorite: true });
    expect(section(OTHER_CATEGORY_ID, result).links.map((item) => item.id)).toEqual(['other', 'github']);
  });

  it('preserves unrelated records and favorite states when reordering a category', () => {
    const destination = section('dev');
    destination.links.reverse();
    const result = applyLinkDrop(links, destination, 'docs', 123);
    expect(result.map((item) => item.id)).toEqual(['docs', 'github', 'youtube', 'other']);
    expect(result[1]).toEqual(links[0]);
    expect(result[2]).toBe(links[2]);
    expect(result[3]).toBe(links[3]);
  });
});
