# Steam wishlist as a home-page section

Date: 2026-06-19
Status: Approved design, pending spec review
Branch: `feat/home-wishlist` (off `feat/steam-connect`)
Issue: #22 (builds on #21)

## Goal

Add the Steam wishlist to the home page as a drag-reorderable section: a
horizontal cover-art carousel, on-sale games first, defaulted near the top.
Clicking a cover opens the same price-history detail modal the Gaming page
uses. Groundwork for collapsing the dashboard to a single customizable page.

## Integration (existing section system)

- `src/lib/home.ts`: add `'wishlist'` to `SECTION_IDS`, placed near the top
  (after `'kategorier'`). `DEFAULT_SECTIONS = [...SECTION_IDS]` picks it up
  automatically; existing users' stored order gets it appended by the
  `order` reconciler in `HomePage.tsx` (missing ids are appended), so it
  still appears for them and stays drag-reorderable.
- `src/components/home/SortableHomeSection.tsx`: import `WishlistSection` and
  add `{id === 'wishlist' && <WishlistSection handleProps={handleProps} />}`.

## New component: `src/components/home/SectionWishlist.tsx`

Modeled on `SectionEksterneLenker` (same `<section>` + `.section-header`
with `GripHandle` + title + "Alle" link, and a horizontal `useDragScroll`
strip). Uses the existing `useWishlist()` + `useSteamConnection()` hooks
(no new data fetching).

- **Header**: grip handle + "Steam ønskeliste" + an "Alle" link to `/gaming`.
- **Body** (connected, has games): a horizontal drag-scroll strip of game
  covers. Order via a pure helper `orderForCarousel(games)` =
  on-sale (by discount desc) first, then the rest (by priority asc). Each
  item: cover image (`imgUrl`, `onError` -> `imgFallback`), a discount badge
  overlay when `onSale`. Clicking opens the shared `GameModal` for that game
  (local `activeGame` state in this component).
- **States**:
  - not connected -> compact box: "Koble til Steam" button (`steamApi.startConnect`)
    + hint "Ønskelisten din på Steam må være offentlig."
  - loading -> a skeleton strip (a few placeholder cover tiles).
  - connected + empty -> small muted "Ønskelisten er tom" note.

## Refactor: extract the game detail modal

The detail modal (cover, metadata, ITAD price-history chart) currently lives
inside `src/pages/GamingPage.tsx` as `GameModal` (plus its `ptagsArr` helper
and chart code). Move it to `src/components/gaming/GameModal.tsx` (exported),
and have `GamingPage` import it from there. No behavior change — pure
extraction. The ONLY shared piece is `GameModal`: `GameCard` stays in
`GamingPage` (it is the full grid card), and the carousel uses its own
lightweight cover tile defined inside `SectionWishlist.tsx`.

## Styling

Reuse the home carousel CSS (`.section-header`, `.ext-grid-wrap`/`.ext-grid`
drag-scroll) and the gaming cover/discount-badge styles. Add a small
`wishlist-cover` tile style as needed. The look gets tuned live against the
dev server after the first cut.

## Testing

- Unit (`*.vitest.ts`): `orderForCarousel(games)` — on-sale-first ordering
  (by discount desc) then remaining by priority asc; stable for empty input.
- `npm run typecheck` + `npm test` + `npm run build` stay green.
- The carousel/modal visuals + drag-scroll are manual verification (dnd /
  scroll interactions are not reliably scriptable per project conventions).

## Out of scope

- The broader single-page / sidebar-removal redesign (separate, later).
- Changing wishlist data, caching, or the connect flow (reused as-is).
- New per-game actions beyond opening the existing modal.

## Rollout order (informs the plan)

1. Extract `GameModal` to `components/gaming/GameModal.tsx`; repoint GamingPage.
2. `orderForCarousel` pure helper + unit test.
3. `SectionWishlist.tsx` (carousel + states + modal wiring).
4. Register the section (`SECTION_IDS` + `SortableHomeSection`).
5. Styling pass + live look iteration.
