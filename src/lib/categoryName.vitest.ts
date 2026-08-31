import { describe, it, expect } from 'vitest';
import { categoryDisplayName, sectionTitle } from './categoryName';
import { FAVORITES_CATEGORY_ID, OTHER_CATEGORY_ID } from '@/api/types';

describe('categoryDisplayName', () => {
  it('renders the favorites pseudo category by id, ignoring the stored English name', () => {
    expect(categoryDisplayName({ id: FAVORITES_CATEGORY_ID, name: 'Favorites' })).toBe('Favoritter');
  });
  it('renders the other pseudo category by id, ignoring the stored English name', () => {
    expect(categoryDisplayName({ id: OTHER_CATEGORY_ID, name: 'Other' })).toBe('Annet');
  });
  it('keeps user category names as stored', () => {
    expect(categoryDisplayName({ id: 'dev', name: 'Utvikling' })).toBe('Utvikling');
  });
});

describe('sectionTitle', () => {
  it('prefixes favorites with a star', () => {
    expect(sectionTitle({ id: FAVORITES_CATEGORY_ID, name: 'Favorites' })).toBe('★ Favoritter');
  });
  it('leaves other sections unprefixed', () => {
    expect(sectionTitle({ id: OTHER_CATEGORY_ID, name: 'Other' })).toBe('Annet');
    expect(sectionTitle({ id: 'dev', name: 'Dev' })).toBe('Dev');
  });
});
