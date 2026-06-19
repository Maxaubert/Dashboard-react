# Steam Wishlist Home Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Steam wishlist to the home page as a drag-reorderable cover-art carousel section (on-sale first), defaulted near the top.

**Architecture:** A new `WishlistSection` plugs into the existing home section system (`SECTION_IDS` + `SortableHomeSection`), reusing the `useWishlist`/`useSteamConnection` hooks. The game detail modal is extracted from `GamingPage` into a shared `components/gaming/GameModal.tsx` so covers open the same price-history view. Carousel ordering is a pure, tested helper.

**Tech Stack:** React + react-router, react-query, @radix-ui/react-dialog, dnd-kit (existing section DnD), vitest.

## Global Constraints

- No em-dashes anywhere (code, comments, commits). No emojis in code/commits.
- UI strings Norwegian (nb-NO).
- Commit trailer exactly: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Branch: `feat/home-wishlist`. Issue: #22.
- vitest only collects `*.vitest.ts`. `@/*` resolves to `src/*`.
- `npm run typecheck` + `npm test` + `npm run build` pass before each commit.
- Reuse existing hooks/flow; do not change wishlist data, caching, or the connect flow.
- Only `GameModal` is shared; `GameCard` stays in `GamingPage`; the carousel uses its own cover tile.

---

## Task 1: Extract `GameModal` into a shared component

**Files:**
- Create: `src/components/gaming/GameModal.tsx`
- Modify: `src/pages/GamingPage.tsx`

**Interfaces:**
- Produces: `GameModal` (named export) — `function GameModal({ game, onClose }: { game: WishlistGame; onClose: () => void })`.

- [ ] **Step 1: Create the shared module**

Create `src/components/gaming/GameModal.tsx`. MOVE, verbatim, from `GamingPage.tsx`: the `PTAG_LABEL` const, the `ptagsArr` function, and the entire `GameModal` function (currently `GamingPage.tsx` lines ~15-26 and ~298 to the end of the modal function). Add the imports the modal needs at the top of the new file:
```ts
import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { WishlistGame } from '@/api/types';
import { buildLineChartSvg, fetchItadHistory, type HistoryPoint } from '@/lib/itadHistory';
```
Add `export` to the `GameModal` function declaration. Keep `PTAG_LABEL` + `ptagsArr` as module-private helpers in this file (the modal is their only user). Copy the bodies exactly; do not change behavior.

- [ ] **Step 2: Repoint `GamingPage.tsx`**

In `GamingPage.tsx`: remove the now-moved `PTAG_LABEL`, `ptagsArr`, and `GameModal` definitions. Add `import { GameModal } from '@/components/gaming/GameModal';`. Then remove imports that are now unused in `GamingPage.tsx` ONLY if nothing else there uses them — check each before removing: `* as Dialog` (radix), `buildLineChartSvg`/`fetchItadHistory`/`HistoryPoint` (itadHistory), and `useEffect` (the `?steam=` effect still uses `useEffect`, so keep it). Run typecheck to catch any that are still referenced.

- [ ] **Step 3: Verify (pure move, no behavior change)**

Run: `npm run typecheck && npm test && npm run build`
Expected: all PASS, no unused-import errors. (No new test: this is a verbatim move. The Gaming page modal opening is manual-verified in Task 5.)

- [ ] **Step 4: Commit**

```bash
git add src/components/gaming/GameModal.tsx src/pages/GamingPage.tsx
git commit -m "$(printf 'refactor: extract GameModal into a shared component\n\nMoves the game detail modal (price-history chart) out of GamingPage so\nthe home wishlist section can open the same modal. Pure move, no\nbehavior change.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 2: `orderForCarousel` helper

**Files:**
- Create: `src/lib/wishlistOrder.ts`
- Test: `src/lib/wishlistOrder.vitest.ts`

**Interfaces:**
- Produces: `orderForCarousel(games: WishlistGame[]): WishlistGame[]` — on-sale games first (discount desc), then the rest (priority asc).

- [ ] **Step 1: Write the failing test**

`src/lib/wishlistOrder.vitest.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { orderForCarousel } from './wishlistOrder';
import type { WishlistGame } from '@/api/types';

function g(p: Partial<WishlistGame> & { appid: string }): WishlistGame {
  return {
    appid: p.appid, name: p.appid, imgUrl: '', imgFallback: '', storeUrl: '',
    isFree: false, price: null, origPrice: '', discount: p.discount ?? 0,
    onSale: p.onSale ?? false, genres: [], priority: p.priority ?? 0,
    dateAdded: 0, priceInt: 0, currency: 'NOK', priceTag: null, itadId: null,
  };
}

describe('orderForCarousel', () => {
  it('puts on-sale games first, sorted by discount desc', () => {
    const out = orderForCarousel([
      g({ appid: 'a', priority: 1 }),
      g({ appid: 'b', onSale: true, discount: 20 }),
      g({ appid: 'c', onSale: true, discount: 60 }),
    ]);
    expect(out.map((x) => x.appid)).toEqual(['c', 'b', 'a']);
  });
  it('sorts the non-sale remainder by priority asc', () => {
    const out = orderForCarousel([
      g({ appid: 'a', priority: 3 }),
      g({ appid: 'b', priority: 1 }),
      g({ appid: 'c', priority: 2 }),
    ]);
    expect(out.map((x) => x.appid)).toEqual(['b', 'c', 'a']);
  });
  it('returns [] for empty input', () => {
    expect(orderForCarousel([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/wishlistOrder.vitest.ts`
Expected: FAIL — cannot find `./wishlistOrder`.

- [ ] **Step 3: Implement `src/lib/wishlistOrder.ts`**

```ts
import type { WishlistGame } from '@/api/types';

/** On-sale games first (deepest discount first), then the rest by wishlist priority. */
export function orderForCarousel(games: WishlistGame[]): WishlistGame[] {
  const onSale = games.filter((game) => game.onSale).sort((a, b) => b.discount - a.discount);
  const rest = games.filter((game) => !game.onSale).sort((a, b) => a.priority - b.priority);
  return [...onSale, ...rest];
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/wishlistOrder.vitest.ts`
Expected: PASS (3 cases).

- [ ] **Step 5: Typecheck + commit**

Run `npm run typecheck` (PASS), then:
```bash
git add src/lib/wishlistOrder.ts src/lib/wishlistOrder.vitest.ts
git commit -m "$(printf 'feat: orderForCarousel wishlist ordering helper\n\nOn-sale games first (discount desc), then the rest by priority asc.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 3: `WishlistSection` component + baseline styles

**Files:**
- Create: `src/components/home/SectionWishlist.tsx`
- Modify: `src/index.css` (or the global stylesheet where `.ext-grid`/`.gaming-*` live — grep `\.ext-grid` to locate it)

**Interfaces:**
- Consumes: `useWishlist`, `useSteamConnection` (`@/hooks/useWishlist`); `orderForCarousel` (`@/lib/wishlistOrder`); `GameModal` (`@/components/gaming/GameModal`); `steamApi` (`@/api/steam`); `useDragScroll` (`@/hooks/useDragScroll`); `GripHandle`, `HandleProps` (`@/components/home/GripHandle`).
- Produces: `WishlistSection` (named export) — `function WishlistSection({ handleProps }: { handleProps?: HandleProps })`.

- [ ] **Step 1: Create `src/components/home/SectionWishlist.tsx`**

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWishlist, useSteamConnection } from '@/hooks/useWishlist';
import { useDragScroll } from '@/hooks/useDragScroll';
import { orderForCarousel } from '@/lib/wishlistOrder';
import { steamApi } from '@/api/steam';
import { GameModal } from '@/components/gaming/GameModal';
import { GripHandle, type HandleProps } from '@/components/home/GripHandle';
import type { WishlistGame } from '@/api/types';

export function WishlistSection({ handleProps }: { handleProps?: HandleProps }) {
  const { data: conn } = useSteamConnection();
  const { data: wl, isLoading } = useWishlist();
  const [active, setActive] = useState<WishlistGame | null>(null);

  const connected = wl?.connected ?? conn?.connected ?? false;
  const games = orderForCarousel(wl?.games ?? []);
  const scrollerRef = useDragScroll<HTMLDivElement>({ infinite: false });

  return (
    <section>
      <div className="section-header">
        <span>
          <GripHandle handleProps={handleProps} />
          Steam ønskeliste
        </span>
        <Link to="/gaming" className="section-header-link">
          Alle
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z" />
          </svg>
        </Link>
      </div>

      {!connected && !isLoading ? (
        <div className="wishlist-connect-box">
          <p>Koble til Steam for å vise ønskelisten din.</p>
          <p className="wishlist-connect-hint">Ønskelisten din på Steam må være offentlig.</p>
          <button className="gaming-filter-btn active" onClick={() => steamApi.startConnect()}>
            Koble til Steam
          </button>
        </div>
      ) : (
        <div className="ext-grid-wrap">
          <div className="ext-grid wishlist-strip" ref={scrollerRef}>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="wishlist-cover wishlist-cover-skeleton" />
              ))
            ) : games.length === 0 ? (
              <div className="wishlist-empty-note">Ønskelisten er tom</div>
            ) : (
              games.map((game) => (
                <WishlistCover key={game.appid} game={game} onClick={() => setActive(game)} />
              ))
            )}
          </div>
        </div>
      )}

      {active && <GameModal game={active} onClose={() => setActive(null)} />}
    </section>
  );
}

function WishlistCover({ game, onClick }: { game: WishlistGame; onClick: () => void }) {
  return (
    <button type="button" className="wishlist-cover" onClick={onClick} title={game.name}>
      <img
        src={game.imgUrl}
        alt={game.name}
        loading="lazy"
        onError={(e) => {
          const img = e.target as HTMLImageElement;
          if (game.imgFallback && img.src !== game.imgFallback) img.src = game.imgFallback;
          else img.style.display = 'none';
        }}
      />
      {game.onSale && <span className="wishlist-cover-badge">-{game.discount}%</span>}
    </button>
  );
}
```

Note: confirm `useDragScroll` accepts `{ infinite: false }` (read `src/hooks/useDragScroll.ts`); if its options differ, pass the equivalent "non-looping" option, or omit options if a plain draggable scroll is the default.

- [ ] **Step 2: Add baseline styles**

Locate the global stylesheet (grep `\.ext-grid` — likely `src/index.css`). Append:
```css
/* Home wishlist carousel */
.wishlist-strip { gap: 10px; }
.wishlist-cover {
  position: relative;
  flex: 0 0 auto;
  width: 160px;
  height: 75px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--color-border, #2a2a2a);
  background: #12141a;
  padding: 0;
  cursor: pointer;
}
.wishlist-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.wishlist-cover-skeleton { background: linear-gradient(90deg, #14161c, #1c1f27, #14161c); }
.wishlist-cover-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  background: #4c1d95;
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 6px;
}
.wishlist-connect-box {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}
.wishlist-connect-hint { color: var(--color-text-muted); font-size: 0.8rem; }
.wishlist-empty-note { color: var(--color-text-muted); font-size: 0.8rem; padding: 8px 0; }
```
(These are a sane first cut; exact look is tuned in Task 5. Use the project's existing CSS variables where they exist.)

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS. (The component is not yet wired into the page; that is Task 4. No unit test — it is presentational; `orderForCarousel` is tested separately.)

- [ ] **Step 4: Commit**

```bash
git add src/components/home/SectionWishlist.tsx src/index.css
git commit -m "$(printf 'feat: WishlistSection home carousel component\n\nCover-art carousel (on-sale first) with connect/loading/empty states,\nopening the shared GameModal. Not yet registered in the section list.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 4: Register the section in the home list

**Files:**
- Modify: `src/lib/home.ts`
- Modify: `src/components/home/SortableHomeSection.tsx`

**Interfaces:**
- Consumes: `WishlistSection` from `@/components/home/SectionWishlist`.

- [ ] **Step 1: Add the section id near the top**

In `src/lib/home.ts`, add `'wishlist'` to `SECTION_IDS` right after `'kategorier'`:
```ts
export const SECTION_IDS = [
  'prompt-launcher',
  'kategorier',
  'wishlist',
  'widgets',
  'ext-lenker',
  'dagens-plan',
  'vaer',
  'nyhetssaker',
] as const;
```
(`DEFAULT_SECTIONS = [...SECTION_IDS]` picks it up; the `order` reconciler in `HomePage.tsx` appends it for users with a stored order, so it always renders and stays drag-reorderable.)

- [ ] **Step 2: Render it in `SortableHomeSection.tsx`**

Add the import:
```ts
import { WishlistSection } from '@/components/home/SectionWishlist';
```
and the render line alongside the others:
```tsx
      {id === 'wishlist' && <WishlistSection handleProps={handleProps} />}
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm test && npm run build`
Expected: all PASS (existing 82+ tests green; `SectionId` union now includes `'wishlist'` with no exhaustiveness errors).

- [ ] **Step 4: Commit**

```bash
git add src/lib/home.ts src/components/home/SortableHomeSection.tsx
git commit -m "$(printf 'feat: register the wishlist section on the home page\n\nAdds the wishlist section near the top of the home list; drag-reorderable\nlike the others.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 5: Live look iteration (manual, with the user)

**Files:**
- Modify: `src/index.css` (and possibly `SectionWishlist.tsx` for layout tweaks)

This task is interactive visual tuning, not a fixed test cycle. The structure is in place after Task 4; now refine the look against the running app.

- [ ] **Step 1: Run the dev server and view the section**

`npm run dev`, open the home page, log in. Confirm the "Steam ønskeliste" section renders near the top with the cover carousel (on-sale first), the connect box appears when disconnected, and clicking a cover opens the price-history modal.

- [ ] **Step 2: Iterate on the look with the user**

Adjust cover size, spacing, badge style, header, hover/scroll feel based on the user's feedback. Each visual change: edit `src/index.css` (or the component), eyeball in the browser, repeat. Keep `npm run typecheck`/`npm run build` green.

- [ ] **Step 3: Manual verification checklist**

- Section appears near the top, drag-reorders correctly (grip handle), order persists on reload.
- Connected: covers render, on-sale first with discount badges, cover `onError` falls back then hides.
- Clicking a cover opens the shared `GameModal` with the price chart; closing works.
- Not connected: connect box + "Koble til Steam" works; public-wishlist hint shown.
- The Gaming page modal still works (Task 1 extraction did not regress it).

- [ ] **Step 4: Commit the final styling**

```bash
git add -A
git commit -m "$(printf 'style: tune the home wishlist carousel look\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Self-Review

**Spec coverage:**
- Integration via section system (`SECTION_IDS` + `SortableHomeSection`, near top) → Task 4.
- New `SectionWishlist` carousel modeled on `SectionEksterneLenker`, on-sale first, states (connect/loading/empty) → Task 3.
- Reuse `useWishlist`/`useSteamConnection`, no data changes → Tasks 3 (imports only).
- Extract `GameModal` to shared, GamingPage repointed, only the modal shared → Task 1.
- `orderForCarousel` pure tested helper → Task 2.
- Styling + live look iteration → Tasks 3 (baseline) + 5 (tuning).
- Testing: `orderForCarousel` unit test; typecheck/test/build gates; manual carousel/modal/DnD verification → Tasks 2-5.
All spec sections map to a task.

**Placeholder scan:** Task 1 is a verbatim MOVE described as a move (the modal body is ~60 lines already in the repo at cited lines), not re-typed — appropriate, since re-typing risks divergence from the working original. Task 5 is explicitly interactive visual tuning (no fixed code), which matches the spec's "tuned live" intent. Every other code step has complete code.

**Type consistency:** `WishlistSection({ handleProps })` produced by Task 3 matches its use in Task 4. `GameModal({ game, onClose })` produced by Task 1 matches its use in Task 3. `orderForCarousel(games): WishlistGame[]` defined in Task 2, consumed in Task 3. `WishlistGame` shape used in the test helper matches `src/api/types`. The `'wishlist'` SectionId added in Task 4 matches the `id === 'wishlist'` render guard.
