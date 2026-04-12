# Link Categorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-link categorization to the `LinksLibrary` (used by `/links` and `LinksLibraryPopup`) with favorites as a derived section, drag-reorderable sections, cross-section link drag, and right-click rename/delete.

**Architecture:** A pure `groupLinks(links, categories)` helper produces an ordered list of sections; the section list is rendered by a refactored `LinksLibrary`. Categories are persisted alongside links via a versioned envelope on `/api/links`. `__favorites` and `__other` are pseudo-categories that anchor derived sections in the same `order` field as user categories.

**Tech Stack:** React 18, TypeScript, Vite, @tanstack/react-query (existing), @dnd-kit/core + /sortable (existing), Radix UI primitives (existing). No new runtime deps. Python http.server backend (`api.py` in the legacy repo).

**Spec reference:** `docs/superpowers/specs/2026-04-12-link-categorization-design.md` (on main branch, visible from this worktree).

**Worktree:** `.worktrees/feat-link-categorization/` on branch `feat/link-categorization`.

---

## File Structure

**Created:**
- `src/lib/groupLinks.ts` — pure grouping helper
- `src/lib/groupLinks.test.ts` — standalone test script (no test runner dep; run via `npx tsx`)
- `src/components/links/SectionHeader.tsx` — section header with grip, count, inline rename, right-click menu
- `src/components/links/CategoryPickerRow.tsx` — radio list + create-new row for the edit modal
- `src/hooks/useCategories.ts` — CRUD helpers for the categories array (create / rename / delete / reorder)

**Modified:**
- `src/api/types.ts` — add `category?: string` to `LinkItem`, add `Category` and `LinksEnvelope` types
- `src/api/links.ts` — consume/produce `LinksEnvelope` v2
- `src/hooks/useLinks.ts` — return `{ links, categories }`, update `useSaveLinks` to save the full envelope
- `src/pages/LinksPage.tsx` — `LinksLibrary` refactored to render sections via `groupLinks`; `LinkEditModal` integrates `CategoryPickerRow`
- `../Claude Cowrk Projects/Dashboard/api.py` — links handler accepts v2 envelope with back-compat read

---

## Task 1: Add `tsx` dev dep for running the standalone test script

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install `tsx` as a dev dep**

```bash
npm install --save-dev tsx
```

Expected: `added 1 package` (or similar).

- [ ] **Step 2: Verify `tsx` is available**

```bash
npx tsx --version
```

Expected: prints a version like `4.x.x`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add tsx dev dep for running standalone test scripts"
```

---

## Task 2: Extend data model in `src/api/types.ts`

**Files:**
- Modify: `src/api/types.ts`

- [ ] **Step 1: Read the existing `LinkItem` block**

Run:
```bash
grep -n "interface LinkItem" src/api/types.ts
```
Expected: one match. Open the file at that line and locate the `LinkItem` interface (ends at the closing `}` before the next `interface` or section divider).

- [ ] **Step 2: Add `category?: string` to `LinkItem`**

In `src/api/types.ts`, inside `interface LinkItem { ... }`, add this line just before `createdAt?: number;`:

```ts
  /** Category id. Undefined → renders in the synthetic "__other" section. */
  category?: string;
```

- [ ] **Step 3: Add `Category` and `LinksEnvelope` after the `LinkItem` block**

Immediately after the closing `}` of `LinkItem`, add:

```ts
/**
 * A category groups links under a named section on the Lenker page.
 * Two reserved ids anchor the derived sections:
 *   - `__favorites` — rendered as "★ Favorites" (membership = links with favorite === true)
 *   - `__other`     — rendered as "Other"      (membership = links with no `category` set)
 * Reserved ids exist only to give those derived sections a position in the
 * drag order; their membership is always computed at render time.
 */
export interface Category {
  id: string;
  name: string;
  /** Ascending sort key — lower numbers render higher on the page. */
  order: number;
  createdAt?: number;
  updatedAt?: number;
}

export const FAVORITES_CATEGORY_ID = '__favorites';
export const OTHER_CATEGORY_ID = '__other';

/**
 * v2 envelope for /api/links. The backend accepts both v1 (bare array)
 * and v2 (this shape) on read, and always writes v2 on save.
 */
export interface LinksEnvelope {
  version: 2;
  links: LinkItem[];
  categories: Category[];
}
```

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```
Expected: no errors. (Unused symbols `Category`, `LinksEnvelope`, `FAVORITES_CATEGORY_ID`, `OTHER_CATEGORY_ID` do not trigger errors because `noUnusedLocals` only applies in file-scope usage.)

- [ ] **Step 5: Commit**

```bash
git add src/api/types.ts
git commit -m "feat(types): add Category, LinksEnvelope, reserved ids"
```

---

## Task 3: Update `src/api/links.ts` to use the v2 envelope

**Files:**
- Modify: `src/api/links.ts`

- [ ] **Step 1: Replace the file contents**

Overwrite `src/api/links.ts` with:

```ts
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
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/api/links.ts
git commit -m "feat(api): consume/produce v2 LinksEnvelope with v1 back-compat"
```

---

## Task 4: Update backend `api.py` to accept/produce v2 envelope

**Files:**
- Modify: `C:/Users/Admin/Documents/Claude Cowrk Projects/Dashboard/api.py` — the links GET and PUT/POST handler branches

> **Note:** The backend lives in the legacy repo (`Documents\Claude Cowrk Projects\Dashboard\api.py`), not this worktree. Edit it in place. The frontend envelope shape must match exactly: `{ "version": 2, "links": [...], "categories": [...] }`.

- [ ] **Step 1: Locate the GET handler for `/api/links`**

```bash
grep -n "/api/links" "C:/Users/Admin/Documents/Claude Cowrk Projects/Dashboard/api.py"
```
Expected: at least two matches — one in a GET branch, one in a POST/PUT branch.

- [ ] **Step 2: Modify the GET `/api/links` branch**

Replace the current body (roughly `data = json.load(open(LINKS_FILE)) if os.path.exists(LINKS_FILE) else []; body = json.dumps(data).encode()`) with:

```python
elif self.path == '/api/links':
    try:
        raw = json.load(open(LINKS_FILE)) if os.path.exists(LINKS_FILE) else []
    except Exception:
        raw = []
    # Accept legacy v1 (bare array) and upgrade to v2 envelope
    if isinstance(raw, list):
        envelope = {
            'version': 2,
            'links': raw,
            'categories': [
                {'id': '__favorites', 'name': 'Favorites', 'order': 0},
                {'id': '__other',     'name': 'Other',     'order': 1000000},
            ],
        }
    else:
        envelope = raw
        envelope.setdefault('version', 2)
        envelope.setdefault('links', [])
        envelope.setdefault('categories', [])
    body = json.dumps(envelope).encode()
```

- [ ] **Step 3: Modify the POST `/api/links` branch**

The POST handler currently writes whatever JSON body it received. Keep that behavior — but add a small normalization guard that upgrades legacy array-shaped writes to v2:

Find the POST branch that sets `file_path = LINKS_FILE` and reads `data = json.loads(self.rfile.read(length))`. Just before writing `data` to disk, add:

```python
if isinstance(data, list):
    data = {'version': 2, 'links': data, 'categories': []}
```

- [ ] **Step 4: Smoke-test the backend**

Start the backend locally (if not already running) and test:

```bash
curl -s http://localhost:3001/api/links | head -c 200
```

Expected: JSON beginning with `{"version": 2, "links": [...`. If the underlying `links.json` is still a bare array, the response should already be wrapped.

- [ ] **Step 5: Commit the backend change**

```bash
cd "C:/Users/Admin/Documents/Claude Cowrk Projects/Dashboard" && git add api.py && git commit -m "feat(links): accept/produce v2 envelope with legacy array back-compat"
```

(If that legacy directory isn't a git repo, skip the commit and just note the change in your session log.)

---

## Task 5: Update `useLinks` hook to expose envelope shape

**Files:**
- Modify: `src/hooks/useLinks.ts`

- [ ] **Step 1: Rewrite the hook file**

Replace the contents of `src/hooks/useLinks.ts` with:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { linksApi } from '@/api/links';
import type { LinksEnvelope } from '@/api/types';
import { queryKeys } from './queryKeys';

/**
 * Fetches the full links library as a v2 envelope: { version, links, categories }.
 * Consumers that only need the flat link array can do `const { data } = useLinks(); const links = data?.links ?? [];`.
 */
export function useLinks() {
  return useQuery({
    queryKey: queryKeys.links,
    queryFn: linksApi.list,
    staleTime: 60_000,
  });
}

/**
 * Saves the entire envelope. Callers construct the full next envelope and call
 * `.mutate(envelope)`. Optimistic update swaps in the next envelope immediately
 * and rolls back on error.
 */
export function useSaveLinks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (envelope: LinksEnvelope) => linksApi.saveAll(envelope),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: queryKeys.links });
      const previous = qc.getQueryData<LinksEnvelope>(queryKeys.links);
      qc.setQueryData(queryKeys.links, next);
      return { previous };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.links, ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.links });
    },
  });
}
```

- [ ] **Step 2: Run typecheck — it will fail because `LinksPage.tsx` still calls `useSaveLinks().mutate(links)` with a bare array**

```bash
npm run typecheck
```
Expected: TS errors in `src/pages/LinksPage.tsx` around the `persist(next)` and `useSaveLinks()` usages.

- [ ] **Step 3: Do NOT fix `LinksPage.tsx` here — Task 8 rewrites it**

Commit just the hook change on its own, with a clear message noting the break. This is intentional: the plan progresses in small, typed checkpoints and Task 8 is the companion fix.

```bash
git add src/hooks/useLinks.ts
git commit -m "feat(useLinks): expose v2 envelope (breaks LinksPage until Task 8)"
```

---

## Task 6: Pure grouping helper + standalone test script (TDD)

**Files:**
- Create: `src/lib/groupLinks.ts`
- Create: `src/lib/groupLinks.test.ts`

- [ ] **Step 1: Write the failing test first**

Create `src/lib/groupLinks.test.ts` with:

```ts
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
  // Put __other before __favorites before any user category
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

// ── result ────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx tsx src/lib/groupLinks.test.ts
```
Expected: fails with a module-not-found error (`groupLinks` doesn't exist yet).

- [ ] **Step 3: Implement the minimal helper**

Create `src/lib/groupLinks.ts`:

```ts
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
  // Build a lookup so we can tell valid category ids from orphans.
  const byId = new Map<string, Category>();
  for (const c of categories) byId.set(c.id, c);

  // Partition links into favorites / per-user-category / other buckets.
  const favorites: LinkItem[] = [];
  const perUser = new Map<string, LinkItem[]>();
  const other: LinkItem[] = [];

  for (const l of links) {
    if (l.favorite === true) {
      favorites.push(l);
      continue;
    }
    if (l.category && byId.has(l.category) && l.category !== FAVORITES_CATEGORY_ID && l.category !== OTHER_CATEGORY_ID) {
      const bucket = perUser.get(l.category) ?? [];
      bucket.push(l);
      perUser.set(l.category, bucket);
      continue;
    }
    // No category, or orphan category id, or pointing at a pseudo-category
    other.push(l);
  }

  // Sort categories by order ascending. This governs section rendering order
  // for user AND pseudo-categories (favorites/other) uniformly.
  const sorted = [...categories].sort((a, b) => a.order - b.order);

  // Emit sections. Skip empty sections.
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
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx tsx src/lib/groupLinks.test.ts
```
Expected: all assertions pass, ends with `N passed, 0 failed`.

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```
Expected: no errors in `groupLinks.ts` or `.test.ts`. (The LinksPage break from Task 5 is still present — expected.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/groupLinks.ts src/lib/groupLinks.test.ts
git commit -m "feat(lib): add groupLinks helper with standalone test"
```

---

## Task 7: `useCategories` hook — CRUD helpers over the envelope

**Files:**
- Create: `src/hooks/useCategories.ts`

- [ ] **Step 1: Create the hook file**

```ts
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
      // Walk the provided id list in order, assigning ascending order values.
      // Categories not in the list keep their existing order (defensive).
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
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```
Expected: no errors in `useCategories.ts`. (LinksPage still broken from Task 5 — expected.)

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCategories.ts
git commit -m "feat(hooks): add useCategories CRUD with orphan-on-delete"
```

---

## Task 8: Refactor `LinksLibrary` to render sections

This is the big visual task. It fixes the typecheck break from Task 5 and wires up `groupLinks` + section rendering. Drag is NOT added yet (Task 10/11 add it) — keep the existing flat behavior inside each section's grid.

**Files:**
- Modify: `src/pages/LinksPage.tsx`
- Create: `src/components/links/SectionHeader.tsx`

- [ ] **Step 1: Create a minimal `SectionHeader` (no right-click menu yet — Task 12 adds it)**

Create `src/components/links/SectionHeader.tsx`:

```tsx
import { cn } from '@/lib/cn';

interface SectionHeaderProps {
  title: string;
  count: number;
  className?: string;
}

/**
 * Section header for the Lenker library — title + muted count.
 * The drag grip is added in Task 10; the right-click rename/delete menu
 * is added in Task 12. This file intentionally stays minimal for now.
 */
export function SectionHeader({ title, count, className }: SectionHeaderProps) {
  return (
    <div className={cn('links-section-header', className)}>
      <span className="links-section-title">{title}</span>
      <span className="links-section-count">{count}</span>
    </div>
  );
}
```

- [ ] **Step 2: Add the CSS for section headers**

Find the nearest CSS file used by LinksPage. Run:

```bash
grep -rln "links-grid" src/styles src/pages 2>/dev/null
```

Open that file (likely `src/styles/lenker.css` or similar). Append to the bottom:

```css
/* Category section headers (added by link-categorization feature) */
.links-section-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 18px 0 8px;
  color: #e6e8ec;
  font-size: 13px;
  font-weight: 600;
}

.links-section-header:first-child { margin-top: 0; }

.links-section-title {}

.links-section-count {
  font-size: 11px;
  font-weight: 500;
  color: #6b7180;
}
```

If you can't find a matching CSS file, create `src/styles/links-sections.css` with the above block and import it at the top of `src/pages/LinksPage.tsx`:

```ts
import '@/styles/links-sections.css';
```

- [ ] **Step 3: Refactor `LinksLibrary` body**

Open `src/pages/LinksPage.tsx` and replace the `LinksLibrary` function (from the `export function LinksLibrary() {` line through its closing `}`) with:

```tsx
export function LinksLibrary() {
  const { data } = useLinks();
  const saveLinks = useSaveLinks();
  const { toast } = useToast();

  const envelope = data ?? { version: 2 as const, links: [], categories: [] };
  const { links, categories } = envelope;

  const [editing, setEditing] = useState<LinkItem | null>(null);
  const [creating, setCreating] = useState(false);

  const sections = useMemo(() => groupLinks(links, categories), [links, categories]);

  function persist(nextLinks: LinkItem[]) {
    saveLinks.mutate(
      { ...envelope, links: nextLinks },
      { onError: () => toast({ tone: 'danger', title: 'Klarte ikke å lagre' }) },
    );
  }

  function handleSave(item: LinkItem) {
    const idx = links.findIndex((l) => l.id === item.id);
    let next: LinkItem[];
    if (idx >= 0) {
      next = [...links];
      next[idx] = { ...item, updatedAt: Date.now() };
    } else {
      next = [...links, { ...item, createdAt: Date.now(), updatedAt: Date.now() }];
    }
    persist(next);
    setEditing(null);
    setCreating(false);
  }

  function handleDelete(id: string) {
    persist(links.filter((l) => l.id !== id));
    setEditing(null);
  }

  function toggleFavorite(id: string) {
    persist(links.map((l) => (l.id === id ? { ...l, favorite: !l.favorite } : l)));
  }

  function handleReorderWithinSection(nextSectionLinks: LinkItem[], sectionKind: 'favorites' | 'user' | 'other', categoryId?: string) {
    // Rebuild the full links array keeping links from other sections untouched.
    // Identify which links currently belong to this section (same predicates as groupLinks).
    const keep = links.filter((l) => {
      if (sectionKind === 'favorites') return l.favorite !== true;
      if (sectionKind === 'other') return l.favorite === true || (l.category !== undefined && categories.some((c) => c.id === l.category));
      // sectionKind === 'user'
      return l.favorite === true || l.category !== categoryId;
    });
    persist([...keep, ...nextSectionLinks]);
  }

  return (
    <>
      <div className="lenker-header">
        <div className="lenker-title-wrap">
          <div className="lenker-title">Lenkebibliotek</div>
          <div className="lenker-sub">Dine lagrede lenker</div>
        </div>
        <button className="btn-new-link" onClick={() => setCreating(true)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Ny lenke
        </button>
      </div>

      {sections.length === 0 ? (
        <div className="links-grid">
          <div className="links-empty">
            Ingen lenker ennå.
            <br />
            Klikk «Ny lenke» for å legge til den første.
          </div>
        </div>
      ) : (
        sections.map((section) => (
          <div key={section.category.id} className="links-section">
            <SectionHeader
              title={section.kind === 'favorites' ? '★ Favorites' : section.category.name}
              count={section.links.length}
            />
            <SortableList
              items={section.links}
              onReorder={(next) =>
                handleReorderWithinSection(
                  next,
                  section.kind,
                  section.kind === 'user' ? section.category.id : undefined,
                )
              }
              layout="grid"
              className="links-grid"
              renderItem={(link) => (
                <LinkCard
                  link={link}
                  onEdit={() => setEditing(link)}
                  onDelete={() => handleDelete(link.id)}
                  onToggleFavorite={() => toggleFavorite(link.id)}
                />
              )}
            />
          </div>
        ))
      )}

      {(editing || creating) && (
        <LinkEditModal
          item={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSave={handleSave}
          onDelete={editing ? () => handleDelete(editing.id) : undefined}
        />
      )}
    </>
  );
}
```

- [ ] **Step 4: Update imports at the top of `LinksPage.tsx`**

Add these imports near the other imports (replace existing `useLinks`/`useSaveLinks` import line if it only imports those):

```tsx
import { groupLinks } from '@/lib/groupLinks';
import { SectionHeader } from '@/components/links/SectionHeader';
```

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```
Expected: no errors. The break from Task 5 is now fixed.

- [ ] **Step 6: Run dev server and manually verify**

```bash
npm run dev
```

Open `http://localhost:5173/links` (or whatever port Vite chose). Expected:
- All existing links render under an "Other" section header with a count badge
- `★ Favorites` section appears at the top if any links have `favorite: true`
- The page matches the existing visual style otherwise (card grid, hover actions, favorite star)

Kill the dev server (Ctrl+C).

- [ ] **Step 7: Commit**

```bash
git add src/pages/LinksPage.tsx src/components/links/SectionHeader.tsx src/styles/
git commit -m "feat(links): render LinksLibrary as grouped sections via groupLinks"
```

---

## Task 9: `CategoryPickerRow` component + wire into `LinkEditModal`

**Files:**
- Create: `src/components/links/CategoryPickerRow.tsx`
- Modify: `src/pages/LinksPage.tsx` (the `LinkEditModal` function)

- [ ] **Step 1: Create `CategoryPickerRow.tsx`**

```tsx
import { useState } from 'react';
import type { Category, LinkItem } from '@/api/types';
import { FAVORITES_CATEGORY_ID, OTHER_CATEGORY_ID } from '@/api/types';
import { cn } from '@/lib/cn';

interface CategoryPickerRowProps {
  /** All categories (user + pseudo). */
  categories: Category[];
  /** All current links (used for per-row counts). */
  links: LinkItem[];
  /** Currently selected category id (undefined → Other). */
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  /** Called when the user creates a new category — receives the new id. */
  onCreate: (name: string) => string;
}

/**
 * Radio-list picker for assigning a link to a category. Includes a special
 * disabled "Favorites" row (toggled via the ★ button on the card, not the modal)
 * and a "+ Ny kategori…" inline-create row at the bottom.
 */
export function CategoryPickerRow({
  categories,
  links,
  value,
  onChange,
  onCreate,
}: CategoryPickerRowProps) {
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState('');

  // Sort user categories by order; pseudo-categories are handled separately.
  const userCats = categories
    .filter((c) => c.id !== FAVORITES_CATEGORY_ID && c.id !== OTHER_CATEGORY_ID)
    .sort((a, b) => a.order - b.order);

  const favCount = links.filter((l) => l.favorite === true).length;
  const otherCount = links.filter(
    (l) => !l.favorite && !l.category,
  ).length;

  function countFor(catId: string): number {
    return links.filter((l) => !l.favorite && l.category === catId).length;
  }

  function commitCreate() {
    const trimmed = draftName.trim();
    if (!trimmed) {
      setCreating(false);
      setDraftName('');
      return;
    }
    const id = onCreate(trimmed);
    if (id) onChange(id);
    setCreating(false);
    setDraftName('');
  }

  return (
    <div className="cat-picker-list">
      {/* Favorites — read-only anchor */}
      <div
        className={cn('cat-picker-row', 'disabled')}
        title="Bruk stjerneknappen på kortet"
      >
        <span className="cat-picker-radio" />
        <span className="cat-picker-name">★ Favorites</span>
        <span className="cat-picker-count">{favCount}</span>
      </div>

      {/* User categories */}
      {userCats.map((c) => {
        const selected = value === c.id;
        return (
          <div
            key={c.id}
            className={cn('cat-picker-row', selected && 'selected')}
            onClick={() => onChange(c.id)}
          >
            <span className="cat-picker-radio" />
            <span className="cat-picker-name">{c.name}</span>
            <span className="cat-picker-count">{countFor(c.id)}</span>
          </div>
        );
      })}

      {/* Other — selecting it sets value to undefined */}
      <div
        className={cn('cat-picker-row', value === undefined && 'selected')}
        onClick={() => onChange(undefined)}
      >
        <span className="cat-picker-radio" />
        <span className="cat-picker-name">Other</span>
        <span className="cat-picker-count">{otherCount}</span>
      </div>

      {/* Create new */}
      {creating ? (
        <div className="cat-picker-row create-input">
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitCreate();
              if (e.key === 'Escape') {
                setCreating(false);
                setDraftName('');
              }
            }}
            placeholder="Kategorinavn…"
          />
          <button type="button" onClick={commitCreate}>Lagre</button>
        </div>
      ) : (
        <div
          className={cn('cat-picker-row', 'create')}
          onClick={() => setCreating(true)}
        >
          + Ny kategori…
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add CSS for the picker**

Append to the same CSS file used in Task 8 (`src/styles/links-sections.css` or the one already used):

```css
/* Category picker in the link edit modal */
.cat-picker-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cat-picker-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 6px;
  font-size: 12px;
  color: #d6d8dd;
  cursor: pointer;
}

.cat-picker-row:hover { background: rgba(255,255,255,0.04); }

.cat-picker-row.selected {
  background: rgba(167,139,250,0.12);
  color: #e6e8ec;
}

.cat-picker-row.disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.cat-picker-row.create {
  color: #a78bfa;
  font-weight: 500;
}

.cat-picker-radio {
  width: 12px;
  height: 12px;
  border: 1.5px solid #4a4f5a;
  border-radius: 50%;
  flex: 0 0 auto;
  position: relative;
}

.cat-picker-row.selected .cat-picker-radio { border-color: #a78bfa; }
.cat-picker-row.selected .cat-picker-radio::after {
  content: "";
  position: absolute;
  inset: 2px;
  background: #a78bfa;
  border-radius: 50%;
}

.cat-picker-name { flex: 1; }

.cat-picker-count {
  font-size: 10px;
  color: #6b7180;
}

.cat-picker-row.create-input {
  gap: 6px;
}
.cat-picker-row.create-input input {
  flex: 1;
  background: #22262f;
  border: 1px solid #2f333d;
  border-radius: 4px;
  color: #e6e8ec;
  padding: 4px 6px;
  font-size: 12px;
}
.cat-picker-row.create-input button {
  background: #a78bfa;
  color: #0f1115;
  border: none;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
}
```

- [ ] **Step 3: Wire `CategoryPickerRow` into `LinkEditModal`**

In `src/pages/LinksPage.tsx`, find the `LinkEditModal` function. Add an import at the top of the file:

```tsx
import { CategoryPickerRow } from '@/components/links/CategoryPickerRow';
import { useCategories } from '@/hooks/useCategories';
```

Inside `LinkEditModal`, after the `pickerRef` declaration, add:

```tsx
  const { categories, create: createCategory } = useCategories();
  const { data: envelope } = useLinks();
  const allLinks = envelope?.links ?? [];
```

Then add a new modal-row block AFTER the Color row and BEFORE the Icon row:

```tsx
      {/* Category */}
      <div className="modal-row">
        <label>Kategori</label>
        <CategoryPickerRow
          categories={categories}
          links={allLinks}
          value={form.category}
          onChange={(next) => update('category', next)}
          onCreate={createCategory}
        />
      </div>
```

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 5: Manual test**

```bash
npm run dev
```

Open `http://localhost:5173/links`, click an existing link's edit button, verify:
- The modal shows a new "Kategori" row between Farge and Ikon
- Favorites row is disabled/visually muted
- Other is selected by default (existing uncategorized links)
- Clicking "+ Ny kategori…" turns the row into a text input; typing a name + Enter creates it and selects it
- Saving the link persists the category (reload the page → category sticks)

Kill dev server.

- [ ] **Step 6: Commit**

```bash
git add src/components/links/CategoryPickerRow.tsx src/pages/LinksPage.tsx src/styles/
git commit -m "feat(modal): add CategoryPickerRow with inline create"
```

---

## Task 10: Section drag-reorder via dnd-kit

**Files:**
- Modify: `src/pages/LinksPage.tsx` (wrap sections in a sortable DnD context)
- Modify: `src/components/links/SectionHeader.tsx` (add the grip)

- [ ] **Step 1: Add a grip to `SectionHeader`**

Replace `src/components/links/SectionHeader.tsx` with:

```tsx
import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface SectionHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  count: number;
  /** Drag grip ref / attributes from dnd-kit's useSortable, if wrapped. */
  gripRef?: (node: HTMLElement | null) => void;
  gripListeners?: HTMLAttributes<HTMLElement>;
  dragging?: boolean;
}

/**
 * Section header: grip (⋮⋮) + title + count.
 * When rendered inside a dnd-kit sortable context, the parent passes
 * `gripRef` and `gripListeners` so the grip becomes the drag handle.
 */
export const SectionHeader = forwardRef<HTMLDivElement, SectionHeaderProps>(
  function SectionHeader(
    { title, count, gripRef, gripListeners, dragging, className, ...rest },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className={cn('links-section-header', dragging && 'dragging', className)}
        {...rest}
      >
        <span
          ref={gripRef}
          className="links-section-grip"
          {...(gripListeners as React.HTMLAttributes<HTMLElement>)}
          aria-label="Dra for å flytte seksjon"
        >
          ⋮⋮
        </span>
        <span className="links-section-title">{title}</span>
        <span className="links-section-count">{count}</span>
      </div>
    );
  },
);
```

- [ ] **Step 2: Add CSS for the grip**

Append to the section CSS:

```css
.links-section-grip {
  color: #6b7180;
  cursor: grab;
  font-size: 13px;
  letter-spacing: -2px;
  user-select: none;
  padding: 0 2px;
}
.links-section-grip:active { cursor: grabbing; }

.links-section-header.dragging {
  opacity: 0.65;
  background: rgba(167,139,250,0.08);
  border-radius: 4px;
}
```

- [ ] **Step 3: Wrap sections in a `DndContext` + `SortableContext` inside `LinksLibrary`**

At the top of `LinksPage.tsx`, add:

```tsx
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
```

Also add the `useCategories` import if not already imported:

```tsx
import { useCategories } from '@/hooks/useCategories';
```

Inside `LinksLibrary`, call the hook at the top:

```tsx
  const { reorder: reorderCategories } = useCategories();
```

Then create a new subcomponent `SortableSection` inside `LinksPage.tsx` (near `LinkCard`):

```tsx
function SortableSection({
  section,
  onReorderLinks,
  onEdit,
  onDelete,
  onToggleFavorite,
}: {
  section: ReturnType<typeof groupLinks>[number];
  onReorderLinks: (
    nextSectionLinks: LinkItem[],
    sectionKind: 'favorites' | 'user' | 'other',
    categoryId?: string,
  ) => void;
  onEdit: (link: LinkItem) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="links-section" {...attributes}>
      <SectionHeader
        title={section.kind === 'favorites' ? '★ Favorites' : section.category.name}
        count={section.links.length}
        gripListeners={listeners as React.HTMLAttributes<HTMLElement>}
        dragging={isDragging}
      />
      <SortableList
        items={section.links}
        onReorder={(next) =>
          onReorderLinks(
            next,
            section.kind,
            section.kind === 'user' ? section.category.id : undefined,
          )
        }
        layout="grid"
        className="links-grid"
        renderItem={(link) => (
          <LinkCard
            link={link}
            onEdit={() => onEdit(link)}
            onDelete={() => onDelete(link.id)}
            onToggleFavorite={() => onToggleFavorite(link.id)}
          />
        )}
      />
    </div>
  );
}
```

- [ ] **Step 4: Use `SortableSection` inside the sections render loop**

Replace the existing `sections.map((section) => ( <div key=...> ... </div> ))` block in `LinksLibrary` with:

```tsx
        <DndContext
          sensors={useSensors(
            useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
            useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
          )}
          collisionDetection={closestCenter}
          onDragEnd={(e: DragEndEvent) => {
            const { active, over } = e;
            if (!over || active.id === over.id) return;
            const sectionIds = sections.map((s) => s.category.id);
            const oldIndex = sectionIds.indexOf(String(active.id));
            const newIndex = sectionIds.indexOf(String(over.id));
            if (oldIndex < 0 || newIndex < 0) return;
            const nextOrder = arrayMove(sectionIds, oldIndex, newIndex);
            // Merge with any categories that are hidden (empty sections) by
            // appending them at the end in their current relative order.
            const visible = new Set(nextOrder);
            const hidden = categories
              .filter((c) => !visible.has(c.id))
              .sort((a, b) => a.order - b.order)
              .map((c) => c.id);
            reorderCategories([...nextOrder, ...hidden]);
          }}
        >
          <SortableContext
            items={sections.map((s) => s.category.id)}
            strategy={verticalListSortingStrategy}
          >
            {sections.map((section) => (
              <SortableSection
                key={section.category.id}
                section={section}
                onReorderLinks={handleReorderWithinSection}
                onEdit={(l) => setEditing(l)}
                onDelete={handleDelete}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </SortableContext>
        </DndContext>
```

> **Critical fix:** the `useSensors` call must be hoisted OUT of the JSX to avoid a React Hooks-in-JSX violation. Move it to the top of `LinksLibrary`:

```tsx
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
```

And reference `sensors={sensors}` in the JSX.

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 6: Manual test**

```bash
npm run dev
```

On `/links`, verify:
- Each section header shows a ⋮⋮ grip on the left
- Dragging by the grip reorders the whole section up/down
- After drop, the new order persists on reload (backend save succeeded)
- Link reordering within a section still works
- Favorites and Other sections can be dragged freely (no pinning)

Kill dev server.

- [ ] **Step 7: Commit**

```bash
git add src/pages/LinksPage.tsx src/components/links/SectionHeader.tsx src/styles/
git commit -m "feat(links): drag-reorder sections including pseudo-categories"
```

---

## Task 11: Cross-section link drag (recategorize on drop)

**Files:**
- Modify: `src/pages/LinksPage.tsx`

> **Background:** `SortableList` at `src/components/patterns/SortableList.tsx` owns its own internal `DndContext`. Nested contexts from dnd-kit only propagate drags to their own subtree, which means cross-section drags are impossible as long as each section wraps itself in a `SortableList`. This task replaces the per-section `SortableList` usage inside `SortableSection` with a custom inline sortable grid that lives under the single outer `DndContext` introduced in Task 10. Other call sites of `SortableList` elsewhere in the app (todo columns, favorites carousel, home cards) are unaffected.

- [ ] **Step 1: Add `SortableLinkCard` subcomponent**

In `src/pages/LinksPage.tsx`, add this new component near `SortableSection`:

```tsx
function SortableLinkCard({
  link,
  onEdit,
  onDelete,
  onToggleFavorite,
}: {
  link: LinkItem;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: link.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="touch-none" {...attributes} {...listeners}>
      <LinkCard
        link={link}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleFavorite={onToggleFavorite}
      />
    </div>
  );
}
```

- [ ] **Step 2: Replace the per-section `SortableList` with an inline `SortableContext` grid**

Add to the imports at the top of `LinksPage.tsx` (merge with existing dnd-kit imports):

```tsx
import { rectSortingStrategy } from '@dnd-kit/sortable';
```

Inside `SortableSection`, replace the existing `<SortableList ...>` JSX block with:

```tsx
      <SortableContext
        items={section.links.map((l) => l.id)}
        strategy={rectSortingStrategy}
      >
        <div className="links-grid">
          {section.links.map((link) => (
            <SortableLinkCard
              key={link.id}
              link={link}
              onEdit={() => onEdit(link)}
              onDelete={() => onDelete(link.id)}
              onToggleFavorite={() => onToggleFavorite(link.id)}
            />
          ))}
        </div>
      </SortableContext>
```

Also remove the `onReorderLinks` prop from `SortableSection`'s signature — the outer `onDragEnd` (Step 3 below) handles all reordering, so the per-section callback is dead. Update the call site in `LinksLibrary` to stop passing it.

- [ ] **Step 3: Expand the outer `onDragEnd` to handle link drops**

Replace the `onDragEnd` from Task 10 with a handler that distinguishes section drags from link drags by id membership:

```tsx
onDragEnd={(e: DragEndEvent) => {
  const { active, over } = e;
  if (!over || active.id === over.id) return;

  const activeId = String(active.id);
  const overId = String(over.id);

  const sectionIds = sections.map((s) => s.category.id);
  const activeIsSection = sectionIds.includes(activeId);
  const overIsSection = sectionIds.includes(overId);

  if (activeIsSection && overIsSection) {
    // Section reorder — same as Task 10
    const oldIndex = sectionIds.indexOf(activeId);
    const newIndex = sectionIds.indexOf(overId);
    const nextOrder = arrayMove(sectionIds, oldIndex, newIndex);
    const visible = new Set(nextOrder);
    const hidden = categories
      .filter((c) => !visible.has(c.id))
      .sort((a, b) => a.order - b.order)
      .map((c) => c.id);
    reorderCategories([...nextOrder, ...hidden]);
    return;
  }

  // Otherwise it's a link drag. Find source/target sections by walking sections.
  const findSection = (linkId: string) =>
    sections.find((s) => s.links.some((l) => l.id === linkId));
  const sourceSection = findSection(activeId);
  if (!sourceSection) return;

  let targetSection = findSection(overId);
  if (!targetSection && overIsSection) {
    targetSection = sections.find((s) => s.category.id === overId);
  }
  if (!targetSection) return;

  // Within-section reorder
  if (sourceSection === targetSection) {
    const ids = targetSection.links.map((l) => l.id);
    const oldIndex = ids.indexOf(activeId);
    const newIndex = ids.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(targetSection.links, oldIndex, newIndex);
    // Rebuild the full links array keeping links from other sections untouched.
    const keep = links.filter((l) => {
      if (targetSection!.kind === 'favorites') return l.favorite !== true;
      if (targetSection!.kind === 'other') {
        return (
          l.favorite === true ||
          (l.category !== undefined && categories.some((c) => c.id === l.category && c.id !== OTHER_CATEGORY_ID))
        );
      }
      // user
      return l.favorite === true || l.category !== targetSection!.category.id;
    });
    persist([...keep, ...reordered]);
    return;
  }

  // Cross-section drag → update the link's category / favorite flag and persist.
  const movedLink = links.find((l) => l.id === activeId);
  if (!movedLink) return;
  const nextLinkPartial: Partial<LinkItem> = {};
  if (targetSection.kind === 'favorites') {
    nextLinkPartial.favorite = true;
  } else if (targetSection.kind === 'other') {
    nextLinkPartial.category = undefined;
    nextLinkPartial.favorite = false;
  } else {
    nextLinkPartial.category = targetSection.category.id;
    nextLinkPartial.favorite = false;
  }
  const nextLinks = links.map((l) =>
    l.id === activeId ? { ...l, ...nextLinkPartial, updatedAt: Date.now() } : l,
  );
  persist(nextLinks);
}}
```

Add the missing import at the top of `LinksPage.tsx`:

```tsx
import { OTHER_CATEGORY_ID } from '@/api/types';
```

- [ ] **Step 4: Remove the now-dead `handleReorderWithinSection` helper**

It was replaced by the reorder branch inside the new `onDragEnd`. Delete the function body from `LinksLibrary`. Also remove the `SortableList` import from the top of `LinksPage.tsx` if it's no longer used anywhere in the file (grep first: `grep -n "SortableList" src/pages/LinksPage.tsx`).

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 6: Manual test**

```bash
npm run dev
```

Test:
- Drag a card inside "Other" to another position → reorders ✓
- Drag a card from "Other" over to a user category (e.g. "Dev") → card moves, `category` updates
- Drag a card into "Favorites" → star lights up, card appears in Favorites only
- Drag a favorited card out into a user category → loses star, appears under that category
- Drag a card into "Other" → category cleared, card appears in Other

Kill dev server.

- [ ] **Step 7: Commit**

```bash
git add src/pages/LinksPage.tsx
git commit -m "feat(links): cross-section drag recategorizes links"
```

---

## Task 12: Right-click context menu on section headers (rename + delete)

**Files:**
- Modify: `src/components/links/SectionHeader.tsx`
- Modify: `src/pages/LinksPage.tsx`

- [ ] **Step 1: Add inline rename state + right-click handler to `SectionHeader`**

Replace `SectionHeader.tsx` with:

```tsx
import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type MouseEvent,
} from 'react';
import { cn } from '@/lib/cn';

interface SectionHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onRename'> {
  title: string;
  count: number;
  /** If true, this section is a pseudo-category (favorites/other) and cannot be renamed or deleted. */
  readonly?: boolean;
  gripRef?: (node: HTMLElement | null) => void;
  gripListeners?: HTMLAttributes<HTMLElement>;
  dragging?: boolean;
  onRename?: (next: string) => void;
  onDelete?: () => void;
}

export const SectionHeader = forwardRef<HTMLDivElement, SectionHeaderProps>(
  function SectionHeader(
    { title, count, readonly, gripRef, gripListeners, dragging, className, onRename, onDelete, ...rest },
    ref,
  ) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuX, setMenuX] = useState(0);
    const [menuY, setMenuY] = useState(0);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(title);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!menuOpen) return;
      const close = () => setMenuOpen(false);
      window.addEventListener('click', close);
      window.addEventListener('scroll', close, true);
      return () => {
        window.removeEventListener('click', close);
        window.removeEventListener('scroll', close, true);
      };
    }, [menuOpen]);

    const onContextMenu = useCallback(
      (e: MouseEvent<HTMLDivElement>) => {
        if (readonly) return;
        e.preventDefault();
        setMenuX(e.clientX);
        setMenuY(e.clientY);
        setMenuOpen(true);
      },
      [readonly],
    );

    function commitRename() {
      const trimmed = draft.trim();
      if (trimmed && trimmed !== title) onRename?.(trimmed);
      setEditing(false);
    }

    return (
      <div
        ref={ref}
        className={cn('links-section-header', dragging && 'dragging', className)}
        onContextMenu={onContextMenu}
        {...rest}
      >
        <span
          ref={gripRef}
          className="links-section-grip"
          {...(gripListeners as React.HTMLAttributes<HTMLElement>)}
          aria-label="Dra for å flytte seksjon"
        >
          ⋮⋮
        </span>

        {editing ? (
          <input
            className="links-section-rename-input"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') {
                setEditing(false);
                setDraft(title);
              }
            }}
          />
        ) : (
          <span className="links-section-title">{title}</span>
        )}
        <span className="links-section-count">{count}</span>

        {menuOpen && !readonly && (
          <div
            ref={menuRef}
            className="section-context-menu"
            style={{ top: menuY, left: menuX }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              onClick={() => {
                setDraft(title);
                setEditing(true);
                setMenuOpen(false);
              }}
            >
              Rename…
            </div>
            <div
              className="del"
              onClick={() => {
                onDelete?.();
                setMenuOpen(false);
              }}
            >
              Delete
            </div>
          </div>
        )}
      </div>
    );
  },
);
```

- [ ] **Step 2: Add context menu + rename input CSS**

Append to the section CSS:

```css
.links-section-rename-input {
  background: #22262f;
  border: 1px solid #2f333d;
  border-radius: 4px;
  color: #e6e8ec;
  font-size: 13px;
  font-weight: 600;
  padding: 2px 6px;
}

.section-context-menu {
  position: fixed;
  background: #191c23;
  border: 1px solid #353b48;
  border-radius: 6px;
  padding: 4px 0;
  font-size: 12px;
  color: #d6d8dd;
  box-shadow: 0 6px 14px rgba(0,0,0,0.4);
  z-index: 100;
  min-width: 140px;
}
.section-context-menu div {
  padding: 7px 14px;
  cursor: pointer;
}
.section-context-menu div:hover { background: #2a2e36; }
.section-context-menu .del { color: #f87171; }
```

- [ ] **Step 3: Wire rename + delete into `LinksLibrary` via `useCategories`**

Inside `LinksLibrary`, expand the `useCategories()` destructure:

```tsx
  const { reorder: reorderCategories, rename: renameCategory, remove: removeCategory } = useCategories();
```

And update `SortableSection`'s call site to pass the three new props (`readonly`, `onRename`, `onDeleteSection`). Keep the existing `onEdit`, `onDelete` (per-link delete), and `onToggleFavorite` as-is. Task 11 already removed `onReorderLinks`, so the call site should look like:

```tsx
<SortableSection
  key={section.category.id}
  section={section}
  readonly={section.kind !== 'user'}
  onRename={(next) => renameCategory(section.category.id, next)}
  onDeleteSection={() => {
    if (
      confirm(
        section.links.length === 0
          ? `Slett kategorien «${section.category.name}»?`
          : `Slett «${section.category.name}»? ${section.links.length} lenker flyttes til Other.`,
      )
    ) {
      removeCategory(section.category.id);
    }
  }}
  onEdit={(l) => setEditing(l)}
  onDelete={handleDelete}
  onToggleFavorite={toggleFavorite}
/>
```

> **Naming note:** `SortableSection` already has an `onDelete` prop for deleting a *link*. Step 4 below adds a separate `onDeleteSection` prop for deleting a category, which is wired through to `SectionHeader`'s `onDelete` internally.

- [ ] **Step 4: Update `SortableSection` props**

Update `SortableSection` to accept the new `readonly`, `onRename`, and `onDeleteSection` props (and keep `onDelete` as the per-link delete):

```tsx
function SortableSection({
  section,
  readonly,
  onEdit,
  onDelete,        // per-link delete
  onDeleteSection, // category delete (passed to SectionHeader)
  onRename,
  onToggleFavorite,
}: {
  section: ReturnType<typeof groupLinks>[number];
  readonly: boolean;
  onEdit: (link: LinkItem) => void;
  onDelete: (id: string) => void;
  onDeleteSection: () => void;
  onRename: (next: string) => void;
  onToggleFavorite: (id: string) => void;
}) {
  // ...existing useSortable call...
  return (
    <div ref={setNodeRef} style={style} className="links-section" {...attributes}>
      <SectionHeader
        title={section.kind === 'favorites' ? '★ Favorites' : section.category.name}
        count={section.links.length}
        readonly={readonly}
        onRename={onRename}
        onDelete={onDeleteSection}
        gripListeners={listeners as React.HTMLAttributes<HTMLElement>}
        dragging={isDragging}
      />
      {/* ...sortable grid as before... */}
    </div>
  );
}
```

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 6: Manual test**

```bash
npm run dev
```

Test:
- Right-click a user category header → context menu appears with "Rename…" and "Delete"
- Right-click Favorites or Other → context menu does NOT appear (readonly)
- Click "Rename…" → title swaps into a text input, type a new name, press Enter → section title updates and persists
- Click "Delete" on an empty category → confirms "Slett kategorien «X»?" → accept → section disappears
- Click "Delete" on a non-empty category → confirms "Slett «X»? N lenker flyttes til Other." → accept → category gone, links appear in Other

Kill dev server.

- [ ] **Step 7: Commit**

```bash
git add src/components/links/SectionHeader.tsx src/pages/LinksPage.tsx src/styles/
git commit -m "feat(links): right-click rename/delete on section headers"
```

---

## Task 13: Full manual verification + final typecheck + push branch

**Files:** none (verification only)

- [ ] **Step 1: Run full typecheck clean**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 2: Run build to catch any Vite/TS-only issues**

```bash
npm run build
```
Expected: build succeeds; `dist/` created.

- [ ] **Step 3: Run the standalone groupLinks test again**

```bash
npx tsx src/lib/groupLinks.test.ts
```
Expected: all assertions pass.

- [ ] **Step 4: Full manual checklist**

```bash
npm run dev
```

Walk through each flow once:
- [ ] `/links` page loads; existing links appear (in Other until categorized)
- [ ] Favoriting a link moves it to the Favorites section (not duplicated)
- [ ] Create a new category via the edit modal → link moves into that section
- [ ] Drag a section header → sections reorder and persist on reload
- [ ] Drag a link from one section to another → category changes, persists on reload
- [ ] Drag a link into Favorites → favorite flag set
- [ ] Drag a link into Other → category cleared
- [ ] Right-click a user category → rename works inline
- [ ] Right-click a user category → delete with confirm; links fall back to Other
- [ ] Right-click Favorites / Other → no context menu
- [ ] Open the sidebar popup (`LinksLibraryPopup`) → same grouped view, same behaviors

Kill dev server.

- [ ] **Step 5: Final commit with verification note**

```bash
git commit --allow-empty -m "verify: full manual checklist passing for link categorization"
```

- [ ] **Step 6: Announce completion**

Tell the user:
> "Implementation complete on `feat/link-categorization` in the worktree. All manual checks passed. Ready to review, then merge via `superpowers:finishing-a-development-branch`."

---

## Spec Coverage Check

Going section-by-section against `docs/superpowers/specs/2026-04-12-link-categorization-design.md`:

| Spec section | Covered by task(s) |
|---|---|
| Summary, Goals, Non-Goals | N/A (scope framing) |
| Decision 1 — Favorites is a flag | Task 6 (groupLinks rules), Task 8 (section rendering) |
| Decision 2 — Single category | Task 2 (types), Task 9 (picker) |
| Decision 3 — Other at bottom | Task 2 (default `__other` at order 1_000_000), Task 6 (groupLinks test) |
| Decision 4 — Title-case header + count | Task 8 (SectionHeader + CSS) |
| Decision 5 — Radio list picker with + Ny kategori | Task 9 (CategoryPickerRow) |
| Decision 6 — Drag all sections via left grip | Task 10 |
| Decision 7 — Cross-section link drag | Task 11 |
| Decision 8 — Right-click rename/delete | Task 12 |
| Data model: LinkItem, Category, pseudo-categories | Task 2 |
| Data model: envelope | Task 2 |
| Rendering: groupLinks pure function | Task 6 |
| Rendering: hidden empty sections | Task 6 (tested) |
| Edit modal — category picker | Task 9 |
| Drag-and-drop — 3 scopes | Tasks 10, 11 |
| Category management | Task 7 (useCategories), Task 12 (UI) |
| Persistence — v2 envelope + back-compat | Task 3 (frontend client), Task 4 (backend) |
| Migration — first launch is Other-only | Automatic; verified in Task 13 Step 4 |
| Testing — unit (groupLinks) | Task 6 |
| Testing — integration (modal flows) | Task 9 Step 5 (manual), Task 13 Step 4 |
| Testing — manual | Task 13 |

All spec decisions and requirements map to at least one task.

## Open Questions from the Spec

- **Category id generation:** Task 7 uses `crypto.randomUUID()` when available, falling back to `cat_<timestamp>_<random>`. Decision made.
- **Favorites row in edit modal picker:** Task 9 shows it as a disabled row with a tooltip. Decision made.
