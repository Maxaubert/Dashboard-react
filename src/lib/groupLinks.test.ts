import { groupLinks, type SectionRender } from './groupLinks';
import type { Category, LinkItem } from '../api/types';
import { FAVORITES_CATEGORY_ID, OTHER_CATEGORY_ID } from '../api/types';

let failed = 0;
let passed = 0;

function eq(actual: unknown, expected: unknown, msg: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ ${msg}\n    expected: ${e}\n    actual:   ${a}`);
  }
}

// ── helpers ───────────────────────────────────────────────────────────────
const L = (id: string, opts: Partial<LinkItem> = {}): LinkItem => ({
  id, url: `https://example.com/${id}`, name: id, ...opts,
});
const favCat: Category = { id: FAVORITES_CATEGORY_ID, name: 'Favorites', order: 0 };
const otherCat: Category = { id: OTHER_CATEGORY_ID, name: 'Other', order: 1_000_000 };
const dev: Category = { id: 'dev', name: 'Dev', order: 10 };
const media: Category = { id: 'media', name: 'Media', order: 20 };

// ── tests ─────────────────────────────────────────────────────────────────

console.log('groupLinks: empty input');
eq(groupLinks([], []), [], 'returns []');

console.log('groupLinks: only favorites + other pseudo categories, no links');
eq(groupLinks([], [favCat, otherCat]), [], 'hidden when no links belong to them');

console.log('groupLinks: all links uncategorized → Other section only');
{
  const links = [L('a'), L('b')];
  const out = groupLinks(links, [favCat, otherCat]);
  eq(out.length, 1, 'one section');
  eq(out[0].kind, 'other', 'kind=other');
  eq(out[0].links.map((l) => l.id), ['a', 'b'], 'both links in Other');
}

console.log('groupLinks: favorites trumps user category (no duplication)');
{
  const links = [L('a', { favorite: true, category: 'dev' }), L('b', { category: 'dev' })];
  const out = groupLinks(links, [favCat, dev, otherCat]);
  eq(out.length, 2, 'two sections');
  eq(out[0].kind, 'favorites', 'favorites first');
  eq(out[0].links.map((l) => l.id), ['a'], 'a in favorites only');
  eq(out[1].kind, 'user', 'dev second');
  eq(out[1].links.map((l) => l.id), ['b'], 'b in dev (a is not duplicated)');
}

console.log('groupLinks: section order follows Category.order');
{
  const links = [L('x', { category: 'media' }), L('y', { category: 'dev' })];
  const out = groupLinks(links, [favCat, dev, media, otherCat]);
  eq(out.map((s) => (s.kind === 'user' ? s.category.id : s.kind)), ['dev', 'media'], 'dev before media');
}

console.log('groupLinks: Other rendered when mixed with categorized');
{
  const links = [L('a', { category: 'dev' }), L('b')];
  const out = groupLinks(links, [favCat, dev, otherCat]);
  eq(out.map((s) => (s.kind === 'user' ? s.category.id : s.kind)), ['dev', 'other'], 'dev, other');
}

console.log('groupLinks: pseudo-categories can be reordered by order field');
{
  const reorderedFav: Category = { ...favCat, order: 50 };
  const reorderedOther: Category = { ...otherCat, order: 5 };
  const links = [L('a', { favorite: true }), L('b'), L('c', { category: 'dev' })];
  const out = groupLinks(links, [reorderedOther, dev, reorderedFav]);
  eq(out.map((s) => s.kind), ['other', 'user', 'favorites'], 'other, user, favorites');
}

console.log('groupLinks: orphan category id on a link falls back to Other');
{
  const links = [L('a', { category: 'ghost-id' })];
  const out = groupLinks(links, [favCat, otherCat]);
  eq(out.length, 1, 'one section');
  eq(out[0].kind, 'other', 'orphan went to Other');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
